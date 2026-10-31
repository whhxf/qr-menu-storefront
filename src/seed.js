require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const password = (process.env.ADMIN_PASSWORD || 'changeme').trim() || 'changeme';
const hash = bcrypt.hashSync(password, 10);
const mustChange = password.toLowerCase() === 'changeme' ? 1 : 0;

db.exec('DELETE FROM items; DELETE FROM categories; DELETE FROM shop; DELETE FROM admin;');

db.prepare(`
  INSERT INTO shop (id, name, name_alt, tagline, tagline_alt, description, description_alt,
    whatsapp, maps_url, instagram, secondary_lang, secondary_lang_label, currency)
  VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Harbor Roast Café',
  '海港烘焙咖啡',
  'Coffee · Pastries · Quiet corners',
  '咖啡 · 烘焙 · 安静角落',
  'A neighborhood café for laptop mornings and weekend catch-ups. Scan the QR for today’s menu — no app required.',
  '邻里咖啡馆，适合早上来干活、周末见面。扫二维码看今日菜单，不用装 App。',
  '15551234567',
  'https://maps.google.com/?q=Harbor+Roast+Cafe',
  'https://instagram.com/harborroast',
  'zh',
  '中文',
  '$'
);

db.prepare('INSERT INTO admin (id, password_hash, must_change_password) VALUES (1, ?, ?)').run(hash, mustChange);

const cats = [
  { name: "Today's Specials", name_alt: '今日特选', sort: 0 },
  { name: 'Coffee', name_alt: '咖啡', sort: 1 },
  { name: 'Tea & Others', name_alt: '茶饮及其他', sort: 2 },
  { name: 'Pastries', name_alt: '烘焙', sort: 3 },
  { name: 'All-day Bites', name_alt: '全天轻食', sort: 4 },
];

const insertCat = db.prepare(
  'INSERT INTO categories (name, name_alt, sort_order) VALUES (?, ?, ?)'
);
const catIds = {};
for (const c of cats) {
  const info = insertCat.run(c.name, c.name_alt, c.sort);
  catIds[c.name] = info.lastInsertRowid;
}

const insertItem = db.prepare(`
  INSERT INTO items (
    category_id, name, name_alt, description, description_alt, price,
    image_url, allergens, diet_tags, sold_out, is_special, sort_order
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const items = [
  {
    cat: "Today's Specials",
    name: 'Yuzu Cold Brew',
    name_alt: '柚子冷萃',
    description: '12h cold brew with house yuzu syrup and sparkling water.',
    description_alt: '12 小时冷萃配自制柚子糖浆与气泡水。',
    price: 5.5,
    allergens: [],
    diet: ['vegan', 'gluten-free'],
    special: 1,
    sold_out: 0,
    sort: 0,
  },
  {
    cat: "Today's Specials",
    name: 'Miso Butter Croissant',
    name_alt: '味噌黄油可颂',
    description: 'Flaky croissant glazed with white miso butter.',
    description_alt: '酥脆可颂，刷上白味噌黄油。',
    price: 4.8,
    allergens: ['gluten', 'dairy', 'egg'],
    diet: ['vegetarian'],
    special: 1,
    sold_out: 0,
    sort: 1,
  },
  {
    cat: 'Coffee',
    name: 'Espresso',
    name_alt: '意式浓缩',
    description: 'Single origin, rotating weekly.',
    description_alt: '单一产地，每周轮换。',
    price: 3.0,
    allergens: [],
    diet: ['vegan', 'gluten-free'],
    special: 0,
    sold_out: 0,
    sort: 0,
  },
  {
    cat: 'Coffee',
    name: 'Flat White',
    name_alt: '澳白',
    description: 'Double shot, silky microfoam.',
    description_alt: '双份浓缩，细腻奶泡。',
    price: 4.5,
    allergens: ['dairy'],
    diet: ['vegetarian', 'gluten-free'],
    special: 0,
    sold_out: 0,
    sort: 1,
  },
  {
    cat: 'Coffee',
    name: 'Oat Latte',
    name_alt: '燕麦拿铁',
    description: 'Barista oat milk, no extra charge.',
    description_alt: '咖啡师级燕麦奶，不加价。',
    price: 4.8,
    allergens: ['gluten'],
    diet: ['vegan'],
    special: 0,
    sold_out: 0,
    sort: 2,
  },
  {
    cat: 'Coffee',
    name: 'Matcha Latte',
    name_alt: '抹茶拿铁',
    description: 'Ceremonial-grade matcha, hot or iced.',
    description_alt: '仪式级抹茶，热或冰。',
    price: 5.2,
    allergens: ['dairy'],
    diet: ['vegetarian', 'gluten-free'],
    special: 0,
    sold_out: 1,
    sort: 3,
  },
  {
    cat: 'Tea & Others',
    name: 'Jasmine Green Tea',
    name_alt: '茉莉绿茶',
    description: 'Loose leaf, pot for one or two.',
    description_alt: '散茶，一人或两人壶。',
    price: 3.8,
    allergens: [],
    diet: ['vegan', 'gluten-free'],
    special: 0,
    sold_out: 0,
    sort: 0,
  },
  {
    cat: 'Tea & Others',
    name: 'Fresh Orange Juice',
    name_alt: '鲜榨橙汁',
    description: 'Pressed to order.',
    description_alt: '现榨。',
    price: 4.0,
    allergens: [],
    diet: ['vegan', 'gluten-free'],
    special: 0,
    sold_out: 0,
    sort: 1,
  },
  {
    cat: 'Pastries',
    name: 'Almond Croissant',
    name_alt: '杏仁可颂',
    description: 'Filled with almond cream, toasted flakes.',
    description_alt: '杏仁奶油夹心，烤杏仁片。',
    price: 4.5,
    allergens: ['gluten', 'dairy', 'egg', 'nuts'],
    diet: ['vegetarian'],
    special: 0,
    sold_out: 0,
    sort: 0,
  },
  {
    cat: 'Pastries',
    name: 'Banana Bread Slice',
    name_alt: '香蕉面包',
    description: 'Walnut optional — ask counter.',
    description_alt: '可选核桃，柜台询问。',
    price: 3.5,
    allergens: ['gluten', 'egg', 'dairy'],
    diet: ['vegetarian'],
    special: 0,
    sold_out: 0,
    sort: 1,
  },
  {
    cat: 'Pastries',
    name: 'Vegan Brownie',
    name_alt: '纯素布朗尼',
    description: 'Dark chocolate, sea salt.',
    description_alt: '黑巧克力，海盐。',
    price: 3.8,
    allergens: ['gluten', 'soy'],
    diet: ['vegan'],
    special: 0,
    sold_out: 0,
    sort: 2,
  },
  {
    cat: 'All-day Bites',
    name: 'Avocado Toast',
    name_alt: '牛油果吐司',
    description: 'Sourdough, chili flakes, lemon. Add egg +$1.5.',
    description_alt: '酸种吐司、辣椒片、柠檬。加蛋 +$1.5。',
    price: 8.5,
    allergens: ['gluten'],
    diet: ['vegan'],
    special: 0,
    sold_out: 0,
    sort: 0,
  },
  {
    cat: 'All-day Bites',
    name: 'Granola Bowl',
    name_alt: '格兰诺拉碗',
    description: 'Greek yogurt, seasonal fruit, honey.',
    description_alt: '希腊酸奶、时令水果、蜂蜜。',
    price: 7.5,
    allergens: ['dairy', 'nuts', 'gluten'],
    diet: ['vegetarian'],
    special: 0,
    sold_out: 0,
    sort: 1,
  },
  {
    cat: 'All-day Bites',
    name: 'Ham & Cheese Toastie',
    name_alt: '火腿芝士吐司',
    description: 'Smoked ham, cheddar, Dijon.',
    description_alt: '烟熏火腿、切达、第戎芥末。',
    price: 7.0,
    allergens: ['gluten', 'dairy'],
    diet: [],
    special: 0,
    sold_out: 0,
    sort: 2,
  },
];

const DRINK = '/static/img/drink.svg';
const PASTRY = '/static/img/pastry.svg';
const BITE = '/static/img/bite.svg';
const imageFor = {
  'Yuzu Cold Brew': DRINK,
  Espresso: DRINK,
  'Flat White': DRINK,
  'Oat Latte': DRINK,
  'Matcha Latte': DRINK,
  'Jasmine Green Tea': DRINK,
  'Fresh Orange Juice': DRINK,
  'Miso Butter Croissant': PASTRY,
  'Almond Croissant': PASTRY,
  'Banana Bread Slice': PASTRY,
  'Vegan Brownie': PASTRY,
  'Avocado Toast': BITE,
  'Granola Bowl': BITE,
  'Ham & Cheese Toastie': BITE,
};

for (const it of items) {
  insertItem.run(
    catIds[it.cat],
    it.name,
    it.name_alt,
    it.description,
    it.description_alt,
    it.price,
    imageFor[it.name] || '',
    JSON.stringify(it.allergens),
    JSON.stringify(it.diet),
    it.sold_out,
    it.special,
    it.sort
  );
}

console.log('Seeded Harbor Roast Café demo data.');
if (mustChange) {
  console.log('Admin password is the default. The first staff login must change it.');
} else {
  console.log('Admin password set from ADMIN_PASSWORD.');
}
