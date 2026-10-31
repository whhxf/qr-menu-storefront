# Shopfront product brief

Shopfront is a display-only QR menu for a café or small shop that already has a sticker on the table.

**Live demo:** https://sienna-ant-771673.hostingersite.com/

## Who

The owner or the person who closes the shop. They already point guests at a QR code. Today that code opens a PDF, a photo, or a paper insert in a plastic stand. Every price change, allergen fix, sold-out item, or daily special means exporting a new file and often reprinting the insert. They do not want a new register.

They are not buying a POS. They are trying to stop reprinting the menu.

## Job to be done

Guests scan once. Staff update the live menu from a phone. The sticker never needs reprinting for a content change.

A content change is a price, a description, an allergen, a diet tag, a sold-out flag, today’s special, a photo, or the WhatsApp / Maps / Instagram links. The QR URL stays put.

## What “done” feels like

A guest opens the page and understands, without a tour, that this is today’s menu and not a checkout. They can switch to the shop’s second language in one tap, hide an allergen, and see which dish is sold out or on special.

A staff member, standing at the counter with a phone, can mark a dish sold out, set today’s special, change a price, or add a photo. The next guest scan shows it. Nobody walks to a printer.

## Differentiators

- **Bilingual.** English plus a second language on the guest menu. The demo’s second language is 中文.
- **Allergen and diet filters.** Guests hide what they cannot eat, or keep only vegan / vegetarian / gluten-free items.
- **Sold out and today’s special** from the phone admin. Badges show on the next load.
- **WhatsApp, Maps, and Instagram** on the menu, so the page is not a link wall and not a checkout.
- **Dish photos.** A URL or a photo from the phone. A broken image disappears instead of showing a broken icon.
- **One process.** Docker Compose or any Node host. One SQLite file. Uploaded photos sit next to it.
- **Display only.** No cart, no payment, no kitchen ticket, no table ordering.

## Non-goals

Shopfront is **not a POS**.

It will not grow a cart, checkout, payment, kitchen display, order ticket, or “send this table’s order to the bar.” Those products already exist. If a shop needs them, they should buy one. Adding them here would make the menu worse for the shop that only wanted the sticker to stay true.

Also out of scope: multi-tenant hosted accounts, and ordering inside a WeChat mini-program.

## Positioning

| | PDF or paper insert | POS QR ordering | Shopfront |
| --- | --- | --- | --- |
| Guest job | Read a frozen menu | Order and pay | Read today’s menu |
| Staff job | Re-export and reprint | Run the register | Edit the menu on a phone |
| Sticker | Often changes with the file | Tied to the POS | Same URL when the menu changes |
| Allergens | Whatever was printed | Depends on the POS | Filters on the phone |
| Languages | A second print run | Depends on the POS | One tap |
| Data | A file | Their cloud | Your SQLite file |

## Success metrics

- Staff change a price or a sold-out flag from a phone, without a laptop, and the next guest load shows it.
- The printed QR is reprinted only when the URL itself changes, not when the menu content changes.
- A guest does not look for a cart. If an owner asks “where do they pay?”, they are a POS lead, not this user.
- The owner can explain the product in one sentence: the sticker stays, the menu moves.

## 中文摘要

Shopfront 是给已经在桌上贴了二维码的咖啡馆、小店用的**只展示菜单**。客人扫一次，店员用手机改价格、过敏原、售罄和今日特选。贴纸不用为了内容变化而重印。

它不是收银系统：没有购物车、付款、后厨小票或桌边点单。需要那些能力时，去买 POS。需要的是「二维码菜单一直是今天的真菜单」时，用 Shopfront。
