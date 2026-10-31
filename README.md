# Shopfront

A café already has a QR sticker on the table. Today that sticker opens a PDF or a paper insert, and the shop reprints it whenever a price, an allergen, a sold-out item, or today’s special changes.

Shopfront is the menu behind that sticker. Guests scan once. Staff update the live menu from a phone. The sticker stays. There is no app to install.

It is **display only**. It is not a point of sale: no cart, no payment, no kitchen tickets, and no table ordering. A shop that needs those should use a POS.

**Live demo:** https://sienna-ant-771673.hostingersite.com/

## Who it is for

Cafés and small shops that already send guests to a QR code and are tired of reprinting the menu. The person who edits it is the owner or whoever is on the floor with a phone.

## What the guest and the staff get

- **Bilingual.** English plus a second language, one tap. The demo’s second language is 中文.
- **Allergens and diet.** Guests hide an allergen or keep only vegan, vegetarian, or gluten-free items.
- **Sold out and today’s special.** Staff toggle both from the phone. Guests see the badges on the next load.
- **Photos.** A picture on the dish, from a link or an upload. A broken image hides itself.
- **WhatsApp, Maps, and Instagram** on the menu.
- **A table card.** `/admin/qr` prints the card and downloads the QR PNG. Reprint it when the URL changes, not when the soup runs out.
- One SQLite file. Docker Compose keeps it on a named volume.

## What it will not do

- Shopping cart, checkout, or payments
- Kitchen display or order tickets
- Multi-tenant hosted accounts
- WeChat mini-program ordering

## Run locally

Node.js 18 or newer.

```bash
cp .env.example .env
npm install
npm start
```

- Guest menu: http://localhost:3000
- Staff login: http://localhost:3000/admin/login

The first password is `changeme`. The editor will not open until that password is changed. Do not leave `changeme` on a menu that real guests can reach. Set `ADMIN_PASSWORD` before the first seed if you want a real password from the start.

```bash
ADMIN_PASSWORD='a real password' npm run seed
```

`npm run seed` reloads the demo café, **Harbor Roast Café**, and replaces whatever menu is in the database.

Smoke checks (seed, start the server, then):

```bash
npm run smoke
```

Screenshots and a short GIF will live in [`docs/screenshots/`](docs/screenshots/). None are in the repo yet.

## Deploy

The menu has to live somewhere a redeploy will not erase. Docker Compose with the `shopfront_data` volume is the path that does that. A Node host works when `DATA_DIR` is outside the folder the deploy overwrites. A Hostinger Node Web App overwrites the app directory, so it is fine for a demo and the wrong place for a café menu that must survive the next deploy.

Details, the volume, and the password reset warning: [docs/DEPLOY.md](docs/DEPLOY.md).

Change `ADMIN_PASSWORD` before the QR goes on a table. `changeme` is locked out of the editor on first login.

<!-- TODO: replace YOUR_PARTNER_CODE when Hostinger Open Source Partners leaves the waitlist and emails a code. Submitted 2026-10-31. Not an approved partner. See docs/DEPLOY.md. -->

[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/deploy?template=whhxf/qr-menu-storefront&ref=YOUR_PARTNER_CODE)

## Docs

- [Product brief](docs/PRODUCT.md) — who, the job, non-goals
- [Requirements](docs/REQUIREMENTS.md) — P0 / P1 with acceptance criteria
- [Deploy](docs/DEPLOY.md) — Compose, Node, Hostinger Node caveat
- [Messaging](docs/MESSAGING.md) — one sentence, three bullets, “why not a PDF?”, “why not a POS?”

## Stack

- Node.js 20, Express, EJS
- better-sqlite3
- One process, one SQLite file

## License

MIT. See [LICENSE](./LICENSE).
