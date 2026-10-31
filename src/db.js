const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'shopfront.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      name_alt TEXT DEFAULT '',
      tagline TEXT DEFAULT '',
      tagline_alt TEXT DEFAULT '',
      description TEXT DEFAULT '',
      description_alt TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      maps_url TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      secondary_lang TEXT DEFAULT 'zh',
      secondary_lang_label TEXT DEFAULT '中文',
      currency TEXT DEFAULT '$',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_alt TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      name_alt TEXT DEFAULT '',
      description TEXT DEFAULT '',
      description_alt TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      image_url TEXT DEFAULT '',
      allergens TEXT DEFAULT '[]',
      diet_tags TEXT DEFAULT '[]',
      sold_out INTEGER DEFAULT 0,
      is_special INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1
    );
  `);
}

migrate();

module.exports = db;
