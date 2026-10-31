const express = require('express');
const db = require('../db');
const { safeImageUrl } = require('../safe-url');

const router = express.Router();

const ALLERGENS = [
  { id: 'gluten', en: 'gluten', zh: '麸质' },
  { id: 'dairy', en: 'dairy', zh: '乳制品' },
  { id: 'egg', en: 'egg', zh: '蛋' },
  { id: 'nuts', en: 'nuts', zh: '坚果' },
  { id: 'soy', en: 'soy', zh: '大豆' },
  { id: 'shellfish', en: 'shellfish', zh: '贝类' },
  { id: 'fish', en: 'fish', zh: '鱼' },
  { id: 'sesame', en: 'sesame', zh: '芝麻' },
];

const DIET = [
  { id: 'vegan', en: 'vegan', zh: '纯素' },
  { id: 'vegetarian', en: 'vegetarian', zh: '蛋奶素' },
  { id: 'gluten-free', en: 'gluten-free', zh: '无麸质' },
];

const UI = {
  en: {
    eyebrow: 'Menu only · no checkout',
    filters: 'Allergens & diet',
    active: 'active',
    hide: 'Hide if it contains',
    must: 'Only show',
    specials: "Today's specials",
    apply: 'Apply',
    clear: 'Clear',
    empty: 'Nothing matches these filters.',
    special: 'Special',
    sold: 'Sold out',
    foot: 'This page is the menu. It does not take orders or payments — ask staff, or message on WhatsApp.',
    staff: 'Staff',
  },
  zh: {
    eyebrow: '只看菜单 · 不点单不结账',
    filters: '过敏原与饮食',
    active: '已筛选',
    hide: '隐藏含有',
    must: '只看',
    specials: '今日特选',
    apply: '应用',
    clear: '清除',
    empty: '没有符合条件的菜品。',
    special: '特选',
    sold: '售罄',
    foot: '这是菜单，不是点单或付款页面。请向店员下单，或使用 WhatsApp。',
    staff: '店员',
  },
};

function useChineseChrome(shop, lang) {
  return lang === 'alt' && String(shop.secondary_lang || '').toLowerCase().startsWith('zh');
}

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
      image_url: safeImageUrl(it.image_url),
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
  const lang = res.locals.lang;
  const zh = useChineseChrome(shop, lang);
  const ui = zh ? UI.zh : UI.en;
  const labelMap = Object.fromEntries(
    [...ALLERGENS, ...DIET].map((row) => [row.id, zh ? row.zh : row.en])
  );

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

  res.set('Cache-Control', 'no-cache');
  res.render('menu', {
    shop,
    menu,
    ui,
    labelMap,
    allergenOptions: ALLERGENS.map((row) => ({ id: row.id, label: labelMap[row.id] })),
    dietOptions: DIET.map((row) => ({ id: row.id, label: labelMap[row.id] })),
    filters: { exclude, diet, specialsOnly },
    lang,
  });
});

router.get('/api/menu', (_req, res) => {
  const shop = getShop();
  res.set('Cache-Control', 'no-cache');
  res.json({ shop, menu: getMenu() });
});

module.exports = router;
