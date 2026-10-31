const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();
const SESSION_COOKIE = 'sf_admin';
const sessions = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (token && sessions.has(token)) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token && sessions.has(token)) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

router.post('/login', (req, res) => {
  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  const password = (req.body.password || '').toString();
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).render('admin-login', { error: 'Wrong password' });
  }
  const token = makeToken();
  sessions.set(token, { at: Date.now() });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
  res.redirect('/admin/login');
});

router.use(requireAuth);

router.get('/', (_req, res) => {
  const shop = db.prepare('SELECT * FROM shop WHERE id = 1').get();
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
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ id, sold_out: next });
  }
  res.redirect('/admin#items');
});

router.post('/items/:id/toggle-special', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT is_special FROM items WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const next = row.is_special ? 0 : 1;
  db.prepare('UPDATE items SET is_special = ? WHERE id = ?').run(next, id);
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ id, is_special: next });
  }
  res.redirect('/admin#items');
});

router.post('/items/:id/price', (req, res) => {
  const id = Number(req.params.id);
  const price = Number(req.body.price);
  if (Number.isNaN(price) || price < 0) {
    return res.status(400).json({ error: 'invalid price' });
  }
  db.prepare('UPDATE items SET price = ? WHERE id = ?').run(price, id);
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ id, price });
  }
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
    b.image_url || '',
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
    b.image_url || '',
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

router.post('/password', (req, res) => {
  const next = (req.body.password || '').toString();
  if (next.length < 6) {
    return res.status(400).send('Password must be at least 6 characters. <a href="/admin">Back</a>');
  }
  const hash = bcrypt.hashSync(next, 10);
  db.prepare('UPDATE admin SET password_hash = ? WHERE id = 1').run(hash);
  res.redirect('/admin#password');
});

module.exports = router;
