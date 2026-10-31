#!/usr/bin/env node
/**
 * Smoke tests against a running Shopfront instance.
 * Seed first so the staff password is still the default:
 *   ADMIN_PASSWORD=changeme npm run seed
 *   npm start
 *   ADMIN_PASSWORD=changeme npm run smoke
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const PASS = process.env.ADMIN_PASSWORD || 'changeme';
const NEXT_PASS = process.env.SMOKE_NEW_PASSWORD || 'shopfront-smoke';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function csrfFrom(html) {
  const m = String(html).match(/name="_csrf" value="([^"]+)"/);
  assert(m, 'csrf token missing');
  return m[1];
}

function locationPath(res) {
  const loc = res.headers.get('location') || '';
  try {
    return new URL(loc, BASE).pathname;
  } catch {
    return loc.split('?')[0].split('#')[0];
  }
}

function sessionCookie(res) {
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const raw = setCookie.join(';') || res.headers.get('set-cookie') || '';
  const m = raw.match(/sf_admin=([^;]+)/);
  return { raw, cookie: m ? `sf_admin=${m[1]}` : '' };
}

async function main() {
  const results = [];

  {
    const r = await fetch(BASE + '/');
    const text = await r.text();
    assert(r.status === 200, `menu status ${r.status}`);
    assert(!r.headers.get('x-powered-by'), 'x-powered-by leaked');
    assert(text.includes('Harbor Roast'), 'menu missing shop name');
    assert(text.includes('Menu only') && text.includes('no checkout'), 'display-only line missing');
    assert(text.includes('class="item-thumb"'), 'item thumbnail missing');
    assert(text.includes('/static/img/drink.svg'), 'seeded dish image missing');
    assert(text.includes('onerror="this.hidden=true"'), 'image fallback missing');
    assert(!text.includes('Add to cart') && !text.includes('Checkout'), 'menu looks like a cart');
    results.push(['GET / public menu + images', 'PASS', r.status]);
  }

  {
    const r = await fetch(BASE + '/?lang=alt');
    const text = await r.text();
    assert(r.status === 200, `alt menu ${r.status}`);
    assert(text.includes('只看菜单') && text.includes('售罄'), 'Chinese chrome or sold-out badge missing');
    results.push(['GET /?lang=alt bilingual chrome', 'PASS', r.status]);
  }

  {
    const r = await fetch(BASE + '/health');
    const j = await r.json();
    assert(r.status === 200 && j.ok === true, 'health failed');
    results.push(['GET /health', 'PASS', JSON.stringify(j)]);
  }

  {
    const r = await fetch(BASE + '/api/menu');
    const j = await r.json();
    assert(r.status === 200, `api menu ${r.status}`);
    assert(j.shop && j.menu && j.menu.length > 0, 'api menu empty');
    const withImage = j.menu.flatMap((c) => c.items).filter((it) => it.image_url);
    assert(withImage.length > 0, 'api items have no image_url');
    results.push(['GET /api/menu', 'PASS', `${j.menu.length} categories`]);
  }

  {
    const r = await fetch(BASE + '/?exclude=dairy');
    const text = await r.text();
    assert(r.status === 200, `filter ${r.status}`);
    assert(!text.includes('Flat White'), 'dairy filter still shows Flat White');
    assert(text.includes('Espresso'), 'dairy filter dropped a dairy-free item');
    results.push(['GET /?exclude=dairy', 'PASS', 'Flat White hidden']);
  }

  let cookie = '';
  let csrf = '';

  {
    const loginPage = await fetch(BASE + '/admin/login');
    const loginHtml = await loginPage.text();
    assert(loginPage.status === 200, 'login page');
    const loginCsrf = csrfFrom(loginHtml);

    const login = await fetch(BASE + '/admin/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: PASS, _csrf: loginCsrf }),
    });
    assert(login.status === 302 || login.status === 303, `login redirect ${login.status}`);
    assert(locationPath(login) === '/admin/password', `expected password gate, got ${locationPath(login)}`);
    const parsed = sessionCookie(login);
    assert(parsed.cookie, 'missing session cookie');
    cookie = parsed.cookie;
    results.push(['POST /admin/login default password', 'PASS', 'gated']);

    const blocked = await fetch(BASE + '/admin', { redirect: 'manual', headers: { Cookie: cookie } });
    assert(blocked.status === 302 || blocked.status === 303, `admin not gated ${blocked.status}`);
    assert(locationPath(blocked) === '/admin/password', `admin gate location ${locationPath(blocked)}`);

    const menu = await (await fetch(BASE + '/api/menu')).json();
    const first = menu.menu.flatMap((c) => c.items)[0];
    const gatedToggle = await fetch(BASE + `/admin/items/${first.id}/toggle-sold-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Accept: 'application/json' },
    });
    assert(gatedToggle.status === 403, `gated toggle ${gatedToggle.status}`);
    const gatedBody = await gatedToggle.json();
    assert(gatedBody.error === 'password_change_required', JSON.stringify(gatedBody));
    results.push(['Password gate blocks editor', 'PASS', 'password_change_required']);

    const gatePage = await fetch(BASE + '/admin/password', { headers: { Cookie: cookie } });
    const gateHtml = await gatePage.text();
    assert(gatePage.status === 200, `password page ${gatePage.status}`);
    assert(gateHtml.includes('changeme'), 'gate does not name the default password');
    csrf = csrfFrom(gateHtml);

    const stillDefault = await fetch(BASE + '/admin/password', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ password: 'changeme', _csrf: csrf }),
    });
    const stillHtml = await stillDefault.text();
    assert(stillDefault.status === 400, `changeme accepted ${stillDefault.status}`);
    assert(stillHtml.includes('other than the default'), 'default password rejection copy missing');
    results.push(['Reject password changeme', 'PASS', stillDefault.status]);

    const changed = await fetch(BASE + '/admin/password', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ password: NEXT_PASS, _csrf: csrf }),
    });
    assert(changed.status === 302 || changed.status === 303, `password change ${changed.status}`);
    assert(locationPath(changed) === '/admin', `password change location ${locationPath(changed)}`);
    results.push(['POST /admin/password', 'PASS', 'default replaced']);
  }

  {
    const admin = await fetch(BASE + '/admin', { headers: { Cookie: cookie } });
    const html = await admin.text();
    assert(admin.status === 200, `admin ${admin.status}`);
    assert(html.includes('from your phone') || html.includes('Sold out'), 'admin html');
    csrf = csrfFrom(html);
    results.push(['GET /admin', 'PASS', admin.status]);

    const menu = await (await fetch(BASE + '/api/menu')).json();
    const items = menu.menu.flatMap((c) => c.items);
    const first = items[0];
    const second = items[1] || first;
    assert(first, 'no items');
    const before = first.sold_out;

    const noCsrf = await fetch(BASE + `/admin/items/${first.id}/toggle-sold-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Accept: 'application/json' },
    });
    assert(noCsrf.status === 403, `missing csrf ${noCsrf.status}`);
    const noCsrfBody = await noCsrf.json();
    assert(noCsrfBody.error === 'csrf', JSON.stringify(noCsrfBody));
    const unchanged = (await (await fetch(BASE + '/api/menu')).json()).menu
      .flatMap((c) => c.items)
      .find((it) => it.id === first.id);
    assert(unchanged.sold_out === before, 'csrf-less toggle changed sold_out');
    results.push(['POST without CSRF', 'PASS', '403']);

    const toggle = await fetch(BASE + `/admin/items/${first.id}/toggle-sold-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Accept: 'application/json', 'x-csrf-token': csrf },
    });
    assert(toggle.status === 200, `toggle ${toggle.status}`);
    const tj = await toggle.json();
    assert(tj.sold_out === (before ? 0 : 1), `sold_out not flipped: ${JSON.stringify(tj)}`);
    const toggleBack = await fetch(BASE + `/admin/items/${first.id}/toggle-sold-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Accept: 'application/json', 'x-csrf-token': csrf },
    });
    const tb = await toggleBack.json();
    assert(tb.sold_out === before, 'failed to restore sold_out');
    results.push(['POST toggle sold-out', 'PASS', `id=${first.id}`]);

    const newPrice = Number((Number(first.price) + 0.01).toFixed(2));
    const priceRes = await fetch(BASE + `/admin/items/${first.id}/price`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-csrf-token': csrf,
      },
      body: new URLSearchParams({ price: String(newPrice), _csrf: csrf }),
    });
    assert(priceRes.status === 200, `price ${priceRes.status}`);
    const pj = await priceRes.json();
    assert(Number(pj.price) === newPrice, `price not updated ${JSON.stringify(pj)}`);
    await fetch(BASE + `/admin/items/${first.id}/price`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-csrf-token': csrf,
      },
      body: new URLSearchParams({ price: String(first.price), _csrf: csrf }),
    });
    results.push(['POST price update', 'PASS', `${first.price} -> ${newPrice} -> restored`]);

    const imageUrl = 'https://images.example.com/yuzu-cold-brew.jpg';
    const fields = new URLSearchParams();
    fields.set('_csrf', csrf);
    fields.set('name', first.name);
    fields.set('name_alt', first.name_alt || '');
    fields.set('description', first.description || '');
    fields.set('description_alt', first.description_alt || '');
    fields.set('price', String(first.price));
    fields.set('image_url', imageUrl);
    fields.set('category_id', String(first.category_id));
    for (const tag of first.allergens || []) fields.append('allergens', tag);
    for (const tag of first.diet_tags || []) fields.append('diet_tags', tag);
    if (first.sold_out) fields.set('sold_out', '1');
    if (first.is_special) fields.set('is_special', '1');
    const imagePost = await fetch(BASE + `/admin/items/${first.id}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: fields,
    });
    assert(imagePost.status === 302 || imagePost.status === 303, `image url save ${imagePost.status}`);
    const rendered = await (await fetch(BASE + '/')).text();
    assert(rendered.includes(imageUrl), 'guest menu did not render image_url');
    assert(rendered.includes('class="item-thumb"') && rendered.includes('onerror="this.hidden=true"'), 'thumb fallback missing after url save');
    results.push(['Guest renders image_url', 'PASS', imageUrl]);

    const restore = new URLSearchParams(fields);
    restore.set('image_url', first.image_url || '');
    const restored = await fetch(BASE + `/admin/items/${first.id}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: restore,
    });
    assert(restored.status === 302 || restored.status === 303, `restore image ${restored.status}`);

    const form = new FormData();
    form.set('_csrf', csrf);
    form.set('image', new Blob([PNG_1x1], { type: 'image/png' }), 'dot.png');
    const uploaded = await fetch(BASE + `/admin/items/${second.id}/image`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Cookie: cookie },
      body: form,
    });
    assert(uploaded.status === 302 || uploaded.status === 303, `upload ${uploaded.status} ${await uploaded.text()}`);
    const afterUpload = await (await fetch(BASE + '/')).text();
    const src = afterUpload.match(/src="(\/uploads\/[^"]+\.png)"/);
    assert(src, 'uploaded photo not on the guest menu');
    const file = await fetch(BASE + src[1]);
    const bytes = Buffer.from(await file.arrayBuffer());
    assert(file.status === 200, `upload fetch ${file.status}`);
    assert(bytes[0] === 0x89 && bytes[1] === 0x50, 'upload is not a png');
    results.push(['POST dish photo upload', 'PASS', src[1]]);
  }

  {
    const qr = await fetch(BASE + '/admin/qr', { headers: { Cookie: cookie } });
    const html = await qr.text();
    assert(qr.status === 200, `qr page ${qr.status}`);
    assert(html.includes('desk-card') && html.includes('Scan for today'), 'desk card copy missing');
    assert(html.includes(new URL(BASE).host), 'desk card missing menu host');
    const png = await fetch(BASE + '/admin/qr.png?download=1', { headers: { Cookie: cookie } });
    const bytes = Buffer.from(await png.arrayBuffer());
    assert(png.status === 200, `qr png ${png.status}`);
    assert((png.headers.get('content-type') || '').includes('image/png'), 'qr content-type');
    assert(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47, 'qr png magic');
    assert((png.headers.get('content-disposition') || '').includes('shopfront-menu-qr.png'), 'qr download name');
    results.push(['GET /admin/qr desk card + PNG', 'PASS', bytes.length + ' bytes']);
  }

  {
    const logout = await fetch(BASE + '/admin/logout', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ _csrf: csrf }),
    });
    assert(logout.status === 302 || logout.status === 303, `logout ${logout.status}`);

    const loginPage = await fetch(BASE + '/admin/login');
    const loginCsrf = csrfFrom(await loginPage.text());
    const login = await fetch(BASE + '/admin/login', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Forwarded-Proto': 'https',
      },
      body: new URLSearchParams({ password: NEXT_PASS, _csrf: loginCsrf }),
    });
    const parsed = sessionCookie(login);
    assert(locationPath(login) === '/admin', `https login location ${locationPath(login)}`);
    assert(/secure/i.test(parsed.raw), `secure cookie missing: ${parsed.raw}`);
    cookie = parsed.cookie;
    results.push(['Secure cookie on HTTPS', 'PASS', 'Secure']);
  }

  {
    for (const path of ['/cart', '/checkout', '/pay', '/order']) {
      const r = await fetch(BASE + path);
      assert(r.status === 404, `${path} should not exist, got ${r.status}`);
    }
    results.push(['No cart/checkout/pay/order', 'PASS', '404']);
  }

  {
    let page = await fetch(BASE + '/admin/login');
    let token = csrfFrom(await page.text());
    for (let i = 1; i <= 8; i += 1) {
      const bad = await fetch(BASE + '/admin/login', {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password: `wrong-${i}`, _csrf: token }),
      });
      const html = await bad.text();
      assert(bad.status === 401, `attempt ${i} status ${bad.status}`);
      token = csrfFrom(html);
    }
    const locked = await fetch(BASE + '/admin/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'wrong-9', _csrf: token }),
    });
    assert(locked.status === 429, `rate limit ${locked.status}`);
    results.push(['Login rate limit', 'PASS', '429 after 8 failures']);
  }

  console.log('\nShopfront smoke tests @', BASE);
  for (const [name, status, detail] of results) {
    console.log(`  [${status}] ${name} — ${detail}`);
  }
  console.log(`\nAll ${results.length} checks passed.\n`);
}

main().catch((err) => {
  console.error('\nSMOKE FAILED:', err.message);
  process.exit(1);
});
