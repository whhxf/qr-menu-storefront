# Shopfront

**Self-hosted QR digital storefront for cafés and small shops.**

Guests scan a table sticker → bilingual menu with allergen filters → WhatsApp / Maps / Instagram CTAs.  
Staff open `/admin` on their phone → toggle sold-out, mark today’s special, change prices in two taps.

> **Display only.** No cart, no payment, no kitchen display, no ordering. On purpose.

[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/vps/docker-hostinger?compose_url=https://raw.githubusercontent.com/YOUR_USER/shopfront-mvp/main/docker-compose.yml&ref=YOUR_CODE)

> Replace `YOUR_USER` with your GitHub username and `YOUR_CODE` with your [Hostinger Open Source Partners](https://www.hostinger.com/open-source-partners) referral code after you register the repo.

---

## Why this exists

Link-in-bio tools are just link walls. Full POS / QR-ordering SaaS charges per table and locks your data.  
Shopfront is the middle: **your domain, your menu, your VPS**, one `docker compose up`.

Built to deploy cleanly on [Hostinger VPS Docker Manager](https://www.hostinger.com/support/deploy-on-hostinger-button/).

## Features

- Categories, items, prices, descriptions, optional image URL
- Allergen tags + guest “hide if contains” filter
- Diet tags (vegan / vegetarian / gluten-free) + “must be” filter
- Sold-out toggle & today’s special badge
- Fixed CTA slots: WhatsApp, Google Maps, Instagram
- Bilingual fields (English + second language, demo uses 中文)
- Password-protected mobile admin
- SQLite single-file DB (persisted in a Docker volume)
- Seeded demo café: **Harbor Roast Café**

## Quick start (local)

```bash
cp .env.example .env
npm install
npm start
# open http://localhost:3000
# staff: http://localhost:3000/admin/login  (password: changeme)
```

Re-seed demo data:

```bash
ADMIN_PASSWORD=changeme npm run seed
```

Smoke tests (server must be running):

```bash
npm run smoke
```

## Docker / Hostinger

```bash
docker compose up -d --build
```

- App: `http://YOUR_VPS_IP:3000`
- Admin password defaults to `changeme` — change it under **Admin → Password** immediately
- Data lives in the `shopfront_data` volume

### Deploy on Hostinger button

After you push this repo publicly:

1. Join [Open Source Partners](https://www.hostinger.com/open-source-partners) and get your `ref` code  
2. Update the badge URL in this README (`YOUR_USER`, `YOUR_CODE`)  
3. Register the repository in your Hostinger partner dashboard  
4. Share the README / tweet / blog — commissions are on first purchases via your Deploy link  

Raw compose URL shape:

```text
https://raw.githubusercontent.com/YOUR_USER/shopfront-mvp/main/docker-compose.yml
```

## Stack

- Node.js 20 + Express + EJS
- better-sqlite3
- One container, one volume

## Explicit non-goals

- Shopping cart / checkout / payments  
- Kitchen display / order tickets  
- Multi-tenant SaaS  
- WeChat mini-program ordering  

If you need those, use a POS. This is a **menu face**.

## License

MIT — see [LICENSE](./LICENSE).
