const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
const db = require('../db');
const { safeImageUrl } = require('../safe-url');

const router = express.Router();
const SESSION_COOKIE = 'sf_admin';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;

const sessions = new Map();
const loginAttempts = new Map();
const loginCsrf = new Map();

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, db.shopfront.uploadDir),
    filename: (_req, file, cb) => {
      const ext = EXT_BY_TYPE[file.mimetype] || '';
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_TYPE[file.mimetype]) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, or GIF images.'));
  },
});

function tokensMatch(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requestIsHttps(req) {
  if (process.env.COOKIE_SECURE === '1') return true;
  if (process.env.COOKIE_SECURE === '0') return false;
  const forwarded = req.get('x-forwarded-proto');
  if (forwarded && forwarded.split(',')[0].trim() === 'https') return true;
  return req.secure === true;
}

function sessionCookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: requestIsHttps(req),
    path: '/',
    maxAge: SESSION_MS,
  };
}

function clearSessionCookie(res, req) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: requestIsHttps(req),
    path: '/',
  });
}

function adminPath(req) {
  const full = String(req.originalUrl || req.url || '').split('?')[0];
  if (full === '/admin') return '/';
  if (full.startsWith('/admin/')) return full.slice('/admin'.length);
  return req.path || '/';
}

function getSession(req) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.at > SESSION_MS) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function clientIp(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function loginRecord(req) {
  const ip = clientIp(req);
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || rec.resetAt < now) {
    rec = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, rec);
  }
  return rec;
}

function issueLoginCsrf() {
  const now = Date.now();
  for (const [token, exp] of loginCsrf) {
    if (exp < now) loginCsrf.delete(token);
  }
  const token = crypto.randomBytes(18).toString('hex');
  loginCsrf.set(token, now + LOGIN_WINDOW_MS);
  return token;
}

function takeLoginCsrf(token) {
  if (!token || !loginCsrf.has(token)) return false;
  const exp = loginCsrf.get(token);
  loginCsrf.delete(token);
  return exp >= Date.now();
}

function passwordChangeRequired() {
  const row = db.prepare('SELECT must_change_password FROM admin WHERE id = 1').get();
  return !!(row && row.must_change_password);
}

function isDefaultPassword(password) {
  return String(password || '').trim().toLowerCase() === 'changeme';
}

function publicMenuUrl(req) {
  const configured = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const forwarded = req.get('x-forwarded-proto');
  const proto = forwarded ? forwarded.split(',')[0].trim() : req.protocol;
  const host = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  return `${proto}://${host}`;
}

function wantsJson(req) {
  return !!(req.headers.accept && req.headers.accept.includes('application/json'));
}

function readCsrf(req) {
  if (req.body && req.body._csrf) return String(req.body._csrf);
  return req.get('x-csrf-token') || '';
}

function shopRow() {
  return db.prepare('SELECT * FROM shop WHERE id = 1').get();
}

function sniffImage(filePath, mimetype) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(12);
  try {
    fs.readSync(fd, buf, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (mimetype === 'image/png') return buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';
  if (mimetype === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8;
  if (mimetype === 'image/gif') return buf.toString('ascii', 0, 3) === 'GIF';
  if (mimetype === 'image/webp') {
    return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function removeManagedUpload(imageUrl) {
  if (!imageUrl || !String(imageUrl).startsWith('/uploads/')) return;
  const name = path.basename(imageUrl);
  if (!name || name !== String(imageUrl).slice('/uploads/'.length)) return;
  fs.unlink(path.join(db.shopfront.uploadDir, name), () => {});
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (session) {
    req.adminSession = session;
    return next();
  }
  if (wantsJson(req)) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/admin/login');
}

function forcePassword(req, res, next) {
  if (!passwordChangeRequired()) return next();
  const current = adminPath(req);
  if (current === '/password' || current === '/logout') return next();
  if (wantsJson(req)) return res.status(403).json({ error: 'password_change_required' });
  return res.redirect('/admin/password');
}

function adminCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const session = req.adminSession || getSession(req);
  if (!session || !tokensMatch(readCsrf(req), session.csrf)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (wantsJson(req)) return res.status(403).json({ error: 'csrf' });
    return res.status(403).send('That form expired. Refresh the page and try again.');
  }
  return next();
}

router.get('/login', (req, res) => {
  if (getSession(req)) {
    return res.redirect(passwordChangeRequired() ? '/admin/password' : '/admin');
  }
  res.render('admin-login', { error: null, csrf: issueLoginCsrf() });
});

router.post('/login', (req, res) => {
  const rec = loginRecord(req);
  if (rec.count >= LOGIN_MAX_FAILURES) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((rec.resetAt - Date.now()) / 1000))));
    return res.status(429).render('admin-login', {
      error: 'Too many sign-in attempts. Wait a few minutes and try again.',
      csrf: issueLoginCsrf(),
    });
  }
  if (!takeLoginCsrf(req.body && req.body._csrf)) {
    return res.status(403).render('admin-login', {
      error: 'That form expired. Refresh the page and try again.',
      csrf: issueLoginCsrf(),
    });
  }
  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  const password = (req.body.password || '').toString();
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    rec.count += 1;
    return res.status(401).render('admin-login', {
      error: 'Wrong password',
      csrf: issueLoginCsrf(),
    });
  }
  loginAttempts.delete(clientIp(req));
  if (isDefaultPassword(password)) {
    db.prepare('UPDATE admin SET must_change_password = 1 WHERE id = 1').run();
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { at: Date.now(), csrf: crypto.randomBytes(18).toString('hex') });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
  const mustChange = passwordChangeRequired() || isDefaultPassword(password);
  res.redirect(mustChange ? '/admin/password' : '/admin');
});

router.use(requireAuth);
router.use((req, res, next) => {
  res.locals.csrf = req.adminSession.csrf;
  res.locals.mustChangePassword = passwordChangeRequired();
  next();
});
router.use(forcePassword);
router.use((req, res, next) => {
  if (req.method === 'POST' && /^\/items\/\d+\/image$/.test(adminPath(req))) {
    return upload.single('image')(req, res, next);
  }
  return next();
});
router.use(adminCsrf);

router.post('/logout', (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  clearSessionCookie(res, req);
  res.redirect('/admin/login');
});

router.get('/password', (req, res) => {
  res.render('admin-password', {
    shop: shopRow(),
    error: null,
    forced: passwordChangeRequired(),
  });
});

router.post('/password', (req, res) => {
  const forced = passwordChangeRequired();
  const nextPassword = (req.body.password || '').toString().trim();
  if (nextPassword.length < 6) {
    return res.status(400).render('admin-password', {
      shop: shopRow(),
      error: 'Password must be at least 6 characters.',
      forced,
    });
  }
  if (isDefaultPassword(nextPassword)) {
    return res.status(400).render('admin-password', {
      shop: shopRow(),
      error: 'Use a password other than the default.',
      forced,
    });
  }
  const hash = bcrypt.hashSync(nextPassword, 10);
  db.prepare('UPDATE admin SET password_hash = ?, must_change_password = 0 WHERE id = 1').run(hash);
  res.redirect('/admin');
});

router.get('/qr.png', async (req, res, next) => {
  try {
    const menuUrl = publicMenuUrl(req);
    const png = await QRCode.toBuffer(menuUrl, {
      type: 'png',
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'Q',
      color: { dark: '#1c1917', light: '#fffdf8' },
    });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'private, no-store');
    if (String(req.query.download || '') === '1') {
      res.set('Content-Disposition', 'attachment; filename="shopfront-menu-qr.png"');
    }
    res.send(png);
  } catch (err) {
    next(err);
  }
});

router.get('/qr', (req, res) => {
  res.render('admin-qr', { shop: shopRow(), menuUrl: publicMenuUrl(req) });
});

router.get('/', (_req, res) => {
  const shop = shopRow();
  const categories = db
    .prepare('SELECT * FROM categories ORDER BY sort_order, id')
    .all();
  const items = db
    .prepare(
      `SELECT items.*, categories.name AS category_name
       FROM items JOIN categories ON categories.id = items.category_id
       ORDER BY categories.sort_order, items.sort_order, items.id`
    )
    .all()
    .map((it) => ({
      ...it,
      image_url: safeImageUrl(it.image_url),
      allergens: JSON.parse(it.allergens || '[]'),
      diet_tags: JSON.parse(it.diet_tags || '[]'),
    }));
  res.render('admin', { shop, categories, items });
});

router.post('/shop', (req, res) => {
  const b = req.body;
  db.prepare(`
    UPDATE shop SET
      name = ?, name_alt = ?, tagline = ?, tagline_alt = ?,
      description = ?, description_alt = ?,
      whatsapp = ?, maps_url = ?, instagram = ?,
      secondary_lang_label = ?, currency = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(
    b.name || '',
    b.name_alt || '',
    b.tagline || '',
    b.tagline_alt || '',
    b.description || '',
    b.description_alt || '',
    b.whatsapp || '',
    b.maps_url || '',
    b.instagram || '',
    b.secondary_lang_label || '中文',
    b.currency || '$'
  );
  res.redirect('/admin#shop');
});

router.post('/items/:id/toggle-sold-out', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT sold_out FROM items WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const next = row.sold_out ? 0 : 1;
  db.prepare('UPDATE items SET sold_out = ? WHERE id = ?').run(next, id);
  if (wantsJson(req)) return res.json({ id, sold_out: next });
  res.redirect('/admin#items');
});

router.post('/items/:id/toggle-special', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT is_special FROM items WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const next = row.is_special ? 0 : 1;
  db.prepare('UPDATE items SET is_special = ? WHERE id = ?').run(next, id);
  if (wantsJson(req)) return res.json({ id, is_special: next });
  res.redirect('/admin#items');
});

router.post('/items/:id/price', (req, res) => {
  const id = Number(req.params.id);
  const price = Number(req.body.price);
  if (Number.isNaN(price) || price < 0) {
    return res.status(400).json({ error: 'invalid price' });
  }
  db.prepare('UPDATE items SET price = ? WHERE id = ?').run(price, id);
  if (wantsJson(req)) return res.json({ id, price });
  res.redirect('/admin#items');
});

router.post('/items/:id/image', (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) {
    return res.status(400).send('Choose a photo. <a href="/admin#items">Back</a>');
  }
  if (!sniffImage(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).send('That file is not a JPEG, PNG, WebP, or GIF. <a href="/admin#items">Back</a>');
  }
  const row = db.prepare('SELECT image_url FROM items WHERE id = ?').get(id);
  if (!row) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).send('Item not found');
  }
  removeManagedUpload(row.image_url);
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE items SET image_url = ? WHERE id = ?').run(url, id);
  res.redirect('/admin#items');
});

router.post('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const allergens = [].concat(b.allergens || []).filter(Boolean);
  const diet_tags = [].concat(b.diet_tags || []).filter(Boolean);
  db.prepare(`
    UPDATE items SET
      name = ?, name_alt = ?, description = ?, description_alt = ?,
      price = ?, image_url = ?, allergens = ?, diet_tags = ?,
      sold_out = ?, is_special = ?, category_id = ?
    WHERE id = ?
  `).run(
    b.name || '',
    b.name_alt || '',
    b.description || '',
    b.description_alt || '',
    Number(b.price) || 0,
    safeImageUrl(b.image_url),
    JSON.stringify(allergens),
    JSON.stringify(diet_tags),
    b.sold_out ? 1 : 0,
    b.is_special ? 1 : 0,
    Number(b.category_id),
    id
  );
  res.redirect('/admin#items');
});

router.post('/items', (req, res) => {
  const b = req.body;
  const allergens = [].concat(b.allergens || []).filter(Boolean);
  const diet_tags = [].concat(b.diet_tags || []).filter(Boolean);
  db.prepare(`
    INSERT INTO items (
      category_id, name, name_alt, description, description_alt, price,
      image_url, allergens, diet_tags, sold_out, is_special, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 99)
  `).run(
    Number(b.category_id),
    b.name || 'New item',
    b.name_alt || '',
    b.description || '',
    b.description_alt || '',
    Number(b.price) || 0,
    safeImageUrl(b.image_url),
    JSON.stringify(allergens),
    JSON.stringify(diet_tags),
    b.sold_out ? 1 : 0,
    b.is_special ? 1 : 0
  );
  res.redirect('/admin#items');
});

router.post('/categories', (req, res) => {
  const b = req.body;
  db.prepare(
    'INSERT INTO categories (name, name_alt, sort_order) VALUES (?, ?, 99)'
  ).run(b.name || 'New category', b.name_alt || '');
  res.redirect('/admin#categories');
});

router.use((err, req, res, next) => {
  if (!err) return next();
  if (req.file) fs.unlink(req.file.path, () => {});
  if (err.name === 'MulterError' || /Only JPEG/.test(err.message || '')) {
    return res.status(400).send(`${err.message} <a href="/admin#items">Back</a>`);
  }
  return next(err);
});

module.exports = router;
