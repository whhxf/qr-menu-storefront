# Shopfront requirements

Tracked product requirements. Status is the state after the display-only QR menu work (guest photos, phone admin, password gate, table card, deploy notes).

中文：下面是当前产品要求。P0 是「桌上二维码菜单」必须有的；P1 未做。这不是 POS 需求列表。

| ID | Priority | Requirement | Acceptance criteria | Status |
| --- | --- | --- | --- | --- |
| P0-01 | P0 | Display-only guest menu | `GET /` returns the shop menu. The page says it is a menu and not a checkout. There is no cart, checkout, pay, or order route (`404`). | done |
| P0-02 | P0 | Bilingual menu | English plus a second language. Guests switch with one control. Item names, descriptions, and (for 中文) filter chrome and sold-out / special badges follow the language. Demo seed is Harbor Roast Café / 海港烘焙咖啡. | done |
| P0-03 | P0 | Allergen and diet filters | Each item stores allergens and diet tags. Guests can hide items that contain an allergen and keep only items that match every selected diet. `?exclude=dairy` hides dairy items. | done |
| P0-04 | P0 | Sold out and today’s special from a phone | Staff toggle both from `/admin` without a desktop layout. The guest menu shows badges on the next load. Sold-out items stay visible and read as unavailable. | done |
| P0-05 | P0 | WhatsApp, Maps, Instagram | The menu shows those links when the shop has filled them in. They do not turn the page into a link directory or a checkout. | done |
| P0-06 | P0 | Single SQLite file | One `shopfront.db` holds the shop, categories, items, and staff password hash. | done |
| P0-07 | P0 | Data survives a normal restart | `DATA_DIR` chooses the directory (default `./data`). Docker Compose sets `DATA_DIR=/data` and mounts the named volume `shopfront_data`. The database and `uploads/` live in that directory. Docs state that a host which overwrites the app directory (Hostinger Node Web Apps) will wipe a `DATA_DIR` inside that tree. | done |
| P0-08 | P0 | Dish images on the guest menu | An item `image_url` (http, https, or a same-site path) renders as a thumbnail. A broken image hides itself (`onerror`) instead of a broken icon. Unsafe URLs are not rendered. | done |
| P0-09 | P0 | Dish photo from the phone | Staff upload a JPEG, PNG, WebP, or GIF (max 2MB) on the item. The file is stored under `DATA_DIR/uploads` and shown on the guest menu. | done |
| P0-10 | P0 | No live default password | If the staff password is still `changeme`, the first login cannot open the editor or the table card until a different password (at least 6 characters) is saved. Setting the password back to `changeme` is rejected. | done |
| P0-11 | P0 | Secure staff cookie on HTTPS | The session cookie is `HttpOnly` and `SameSite=Lax`. It is marked `Secure` when the request is HTTPS (`X-Forwarded-Proto` or `COOKIE_SECURE=1`). | done |
| P0-12 | P0 | Login rate limit | After 8 failed sign-ins from the same client within 15 minutes, the next attempt is `429`. A successful sign-in clears the counter. | done |
| P0-13 | P0 | CSRF on admin POSTs | State-changing admin requests require the session CSRF token (form field or `x-csrf-token`). A missing token is `403` and does not change data. The login form has its own one-time token. | done |
| P0-14 | P0 | Printable QR desk card | Signed-in staff open `/admin/qr`, see the menu URL, print a simple table card, and download a QR PNG (`/admin/qr.png?download=1`). The QR encodes the public menu URL (`PUBLIC_BASE_URL` or the request host). | done |
| P0-15 | P0 | Product docs | `docs/PRODUCT.md`, `docs/REQUIREMENTS.md`, `docs/DEPLOY.md`, and `docs/MESSAGING.md` describe the café job, non-goals, deploy paths, and public wording. The README leads with that job. | done |
| P1-01 | P1 | Admin chrome in the second language | The guest menu is bilingual. The staff editor is still English. | open |
| P1-02 | P1 | Hide an item without deleting it | `items.visible` exists. The editor has no control for it yet. | open |
| P1-03 | P1 | Password reset that does not re-seed | A forgotten password is recovered today by re-seeding, which replaces the menu. | open |

`npm run smoke` covers the guest menu, allergen filter, bilingual chrome, image URL, photo upload, password gate, CSRF, QR PNG, HTTPS cookie flag, rate limit, and the absence of cart routes. Run it after `npm run seed`.
