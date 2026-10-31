const express = require('express');
const db = require('../db');

const router = express.Router();

const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'soy', 'shellfish', 'fish', 'sesame'];
const DIET = ['vegan', 'vegetarian', 'gluten-free'];

function getShop() {
  return db.prepare('SELECT * FROM shop WHERE id = 1').get();
}

function getMenu() {
  const categories = db
    .prepare(
      'SELECT * FROM categories WHERE visible = 1 ORDER BY sort_order, id'
    )
    .all();
  const items = db
    .prepare(
      'SELECT * FROM items WHERE visible = 1 ORDER BY sort_order, id'
    )
    .all()
    .map((it) => ({
      ...it,
      allergens: JSON.parse(it.allergens || '[]'),
      diet_tags: JSON.parse(it.diet_tags || '[]'),
    }));
  return categories.map((c) => ({
    ...c,
    items: items.filter((i) => i.category_id === c.id),
  }));
}

router.get('/', (req, res) => {
  const shop = getShop();
  if (!shop) return res.status(500).send('Shop not configured. Run npm run seed.');

  const exclude = [].concat(req.query.exclude || []).filter(Boolean);
  const diet = [].concat(req.query.diet || []).filter(Boolean);
  const specialsOnly = req.query.specials === '1';

  let menu = getMenu();
  menu = menu
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => {
        if (specialsOnly && !it.is_special) return false;
        if (exclude.some((a) => it.allergens.includes(a))) return false;
        if (diet.length && !diet.every((d) => it.diet_tags.includes(d))) return false;
        return true;
      }),
    }))
    .filter((cat) => cat.items.length > 0);

  res.render('menu', {
    shop,
    menu,
    allergens: ALLERGENS,
    dietOptions: DIET,
    filters: { exclude, diet, specialsOnly },
    lang: res.locals.lang,
  });
});

router.get('/api/menu', (_req, res) => {
  const shop = getShop();
  res.json({ shop, menu: getMenu() });
});

module.exports = router;
