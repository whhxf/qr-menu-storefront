# Shopfront

A digital QR menu for cafés and small shops. Guests scan the sticker on the table and open today’s menu on their phone. Staff change prices, mark items sold out, and set today’s special from their own phone. No app to install.

Shopfront is **display only**. It is a menu, not a point of sale: no cart, no payment, no kitchen tickets, and no table ordering. If the shop needs those, use a POS. If the shop needs a menu it can update without reprinting the QR sticker, this is it.

**Live demo:** https://sienna-ant-771673.hostingersite.com/

## Who it helps

Cafés (and similar small shops) that already point guests at a QR code, then reprint a PDF or a paper insert every time a price, an allergen, or a sold-out item changes.

## What the menu does

- **Bilingual.** English plus a second language. The seeded demo uses 中文. Guests switch language in one tap.
- **Allergens and diet.** Each item can list allergens and diet tags (vegan, vegetarian, gluten-free). Guests can hide items that contain an allergen, or keep only items that match a diet.
- **Sold out and today’s special.** Staff open `/admin` on a phone and toggle both in a couple of taps. Guests see the badges on the next load.
- **WhatsApp, Maps, and Instagram.** Fixed buttons on the menu so a guest can message the shop, get directions, or open the social profile. The page is the menu, not a link wall.
- Categories, prices, short descriptions, and an optional image URL.
- Password-protected mobile admin.
- One SQLite file. The Docker setup stores it in a volume. The seed data is a demo café, **Harbor Roast Café**.

## Run locally

Requires Node.js 18 or newer.

```bash
cp .env.example .env
npm install
npm start
```

- Guest menu: http://localhost:3000
- Staff login: http://localhost:3000/admin/login (password: `changeme`)

Load the demo café again:

```bash
ADMIN_PASSWORD=changeme npm run seed
```

Smoke checks (start the server first):

```bash
npm run smoke
```

## Deploy

One container, one data volume. The same app also runs on any Node host or VPS.

```bash
docker compose up -d --build
```

Environment variables (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` locally, `/data` in the container | Directory for the SQLite file |
| `ADMIN_PASSWORD` | `changeme` | Initial staff password, applied when the database is first created or re-seeded |

After it is up:

- Menu: `http://YOUR_HOST:3000`
- Change the staff password under **Admin → Password** before the QR goes on a table.
- Menu data stays in the `shopfront_data` volume.

## Stack

- Node.js 20, Express, EJS
- better-sqlite3
- One process, one SQLite file

## What it will not do

- Shopping cart, checkout, or payments
- Kitchen display or order tickets
- Multi-tenant hosted accounts
- WeChat mini-program ordering

## License

MIT. See [LICENSE](./LICENSE).
