require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');

// Auto-seed if empty
const shopCount = db.prepare('SELECT COUNT(*) AS c FROM shop').get().c;
if (shopCount === 0) {
  require('./seed');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(db.shopfront.uploadDir, { index: false, maxAge: '7d' }));

app.locals.parseJson = (s, fallback = []) => {
  try {
    return JSON.parse(s || '[]');
  } catch {
    return fallback;
  }
};

app.use((req, res, next) => {
  res.locals.lang = req.query.lang === 'alt' ? 'alt' : 'en';
  next();
});

app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shopfront listening on http://0.0.0.0:${PORT}`);
});
