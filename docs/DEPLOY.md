# Deploy Shopfront

The menu is one SQLite file plus the dish photos staff upload. Both live in `DATA_DIR`. If a deploy deletes that directory, prices, sold-out flags, and photos are gone. An empty database loads the Harbor Roast demo again.

Change `ADMIN_PASSWORD` before anyone else can sign in. If it is still `changeme`, the editor and the table card stay locked until a staff member sets a different password. Guests can still read the menu.

## A. Docker Compose (recommended)

Use this when the menu has to survive restarts and redeploys.

```bash
docker compose up -d --build
```

- The container sets `DATA_DIR=/data`.
- The named volume `shopfront_data` is mounted at `/data`.
- That volume holds `shopfront.db` (and its WAL files) and `uploads/`.
- `docker compose restart` and `docker compose down` keep the volume.
- `docker compose down -v` deletes the menu.

Set a real password in the environment, or sign in once and replace `changeme` when asked:

```bash
ADMIN_PASSWORD='a long password' docker compose up -d --build
```

If the QR should encode a public origin rather than whatever host the browser used, set `PUBLIC_BASE_URL` (no trailing slash), for example `https://menu.example.com`.

Menu: `http://YOUR_HOST:3000`  
Staff: `http://YOUR_HOST:3000/admin/login`  
Table card: `http://YOUR_HOST:3000/admin/qr`

## B. Any Node host

Node.js 18 or newer.

```bash
cp .env.example .env
npm install
npm run seed
DATA_DIR=/var/lib/shopfront npm start
```

`DATA_DIR` must sit **outside** the directory you overwrite when you publish a new release. Example: the app is unpacked to `/opt/shopfront/releases/2026-10-31`, and `DATA_DIR=/var/lib/shopfront`.

Do not leave the database in `./data` inside the release directory if your deploy tool deletes that directory.

## C. Hostinger Node Web App

A Node Web App redeploy **replaces the application directory**. Shopfront’s default `DATA_DIR` is `./data` inside that tree, so the SQLite file and uploaded photos do not survive the next deploy. The Node Web App does not document a separate durable disk for arbitrary files. After a redeploy the app sees an empty database and seeds the demo café again.

Use the Node Web App for a **demo**. The public demo at https://sienna-ant-771673.hostingersite.com/ follows `main` and can reset when that site redeploys.

For a café whose prices and sold-out state must survive the next deploy, run path A on a VPS (a Hostinger VPS with Docker is a valid place to do that). Do not expect the Node Web App to keep SQLite.

### Deploy on Hostinger button

Hostinger Open Source Partners is **waitlist-only**. Shopfront (`https://github.com/whhxf/qr-menu-storefront`, title Shopfront) was submitted from hPanel on **2026-10-31**. The confirmation said they will send a note when the product launches. **No partner or referral code exists. This project is not an approved OSS Partner.**

The button below is the official pattern. `YOUR_PARTNER_CODE` is a placeholder. It does not attribute a sale. When Hostinger emails a code, replace that value and only that value.

Hostinger’s published partner terms, once a code exists: **20% of the customer’s first purchase** made through the button.

<!-- TODO: replace YOUR_PARTNER_CODE when Hostinger emails an approval. Do not describe Shopfront as an approved partner before that. -->

[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/deploy?template=whhxf/qr-menu-storefront&ref=YOUR_PARTNER_CODE)

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` locally, `/data` in Compose | SQLite file and uploaded photos |
| `ADMIN_PASSWORD` | `changeme` | Initial staff password. `changeme` forces a change on first login. Applied when the database is created or re-seeded. |
| `PUBLIC_BASE_URL` | request host | Origin encoded in the table-card QR |
| `COOKIE_SECURE` | unset | Set to `1` to mark the staff cookie `Secure` even if the app does not see HTTPS itself |

## Forgotten staff password

`npm run seed` sets the password from `ADMIN_PASSWORD` and **replaces the menu with the demo café**. Copy `shopfront.db` out of `DATA_DIR` first if the live menu matters. There is no separate password-reset switch yet (see `P1-03` in [REQUIREMENTS.md](./REQUIREMENTS.md)).

## Screenshots

Guest, filter, phone admin, and table-card images will live in [screenshots/](./screenshots/). None are in the repo yet.

## 中文

菜单数据是 `DATA_DIR` 里的一个 SQLite 文件，加上店员上传的菜品图。部署如果覆盖这个目录，价格和售罄状态会丢。

Docker Compose 把数据放在命名卷 `shopfront_data`（容器内 `/data`），这是要长期使用时的做法。`docker compose down` 不会删卷；`docker compose down -v` 会删掉菜单。

Hostinger 的 Node 网站在重新部署时会覆盖应用目录。默认的 `./data` 就在这个目录里，所以 **Node 网站不适合作为需要保留菜单的正式环境**。演示站可以；正式咖啡馆请用 VPS + Docker Compose。

Open Source Partners 仍是候补。2026-10-31 已提交，还没有推荐码。按钮里的 `YOUR_PARTNER_CODE` 是占位，不能写成「已经是合作伙伴」。批准邮件到达后再替换。按 Hostinger 公开条款，通过按钮产生的客户首单佣金是 20%。
