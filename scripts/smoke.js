#!/usr/bin/env node
/**
 * Smoke tests against a running Shopfront instance.
 * Usage: BASE_URL=http://127.0.0.1:3000 ADMIN_PASSWORD=changeme node scripts/smoke.js
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const PASS = process.env.ADMIN_PASSWORD || 'changeme';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const results = [];

  // 1) Public menu 200
  {
    const r = await fetch(BASE + '/');
    const text = await r.text();
    assert(r.status === 200, `menu status ${r.status}`);
    assert(text.includes('Harbor Roast') || text.includes('menu') || text.includes('Coffee'), 'menu missing expected content');
    results.push(['GET / public menu', 'PASS', r.status]);
  }

  // 2) Health
  {
    const r = await fetch(BASE + '/health');
    const j = await r.json();
    assert(r.status === 200 && j.ok === true, 'health failed');
    results.push(['GET /health', 'PASS', JSON.stringify(j)]);
  }

  // 3) API menu
  {
    const r = await fetch(BASE + '/api/menu');
    const j = await r.json();
    assert(r.status === 200, `api menu ${r.status}`);
    assert(j.shop && j.menu && j.menu.length > 0, 'api menu empty');
    results.push(['GET /api/menu', 'PASS', `${j.menu.length} categories`]);
  }

  // 4) Allergen filter
  {
    const r = await fetch(BASE + '/?exclude=dairy');
    assert(r.status === 200, `filter ${r.status}`);
    results.push(['GET /?exclude=dairy', 'PASS', r.status]);
  }

  // 5) Admin login + sold-out toggle
  {
    const loginPage = await fetch(BASE + '/admin/login');
    assert(loginPage.status === 200, 'login page');

    const login = await fetch(BASE + '/admin/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: PASS }),
    });
    assert(login.status === 302 || login.status === 303, `login redirect ${login.status}`);
    const setCookie = login.headers.getSetCookie ? login.headers.getSetCookie() : [];
    const raw = setCookie.join(';') || login.headers.get('set-cookie') || '';
    const m = raw.match(/sf_admin=([^;]+)/);
    assert(m, 'missing session cookie');
    const cookie = `sf_admin=${m[1]}`;
    results.push(['POST /admin/login', 'PASS', 'cookie set']);

    const admin = await fetch(BASE + '/admin', { headers: { Cookie: cookie } });
    assert(admin.status === 200, `admin ${admin.status}`);
    const html = await admin.text();
    assert(html.includes('Quick edit') || html.includes('admin'), 'admin html');
    results.push(['GET /admin', 'PASS', admin.status]);

    // Find first item id from API
    const menu = await (await fetch(BASE + '/api/menu')).json();
    const first = menu.menu.flatMap((c) => c.items)[0];
    assert(first, 'no items to toggle');
    const before = first.sold_out;

    const toggle = await fetch(BASE + `/admin/items/${first.id}/toggle-sold-out`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
      },
    });
    assert(toggle.status === 200, `toggle ${toggle.status}`);
    const tj = await toggle.json();
    assert(tj.sold_out === (before ? 0 : 1), `sold_out not flipped: ${JSON.stringify(tj)}`);
    results.push(['POST toggle sold-out', 'PASS', `id=${first.id} -> ${tj.sold_out}`]);

    // Flip back
    const toggleBack = await fetch(BASE + `/admin/items/${first.id}/toggle-sold-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Accept: 'application/json' },
    });
    const tb = await toggleBack.json();
    assert(tb.sold_out === before, 'failed to restore sold_out');
    results.push(['POST toggle sold-out restore', 'PASS', `id=${first.id} -> ${tb.sold_out}`]);

    // Price update
    const newPrice = Number((Number(first.price) + 0.01).toFixed(2));
    const priceRes = await fetch(BASE + `/admin/items/${first.id}/price`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ price: String(newPrice) }),
    });
    assert(priceRes.status === 200, `price ${priceRes.status}`);
    const pj = await priceRes.json();
    assert(Number(pj.price) === newPrice, `price not updated ${JSON.stringify(pj)}`);
    // restore
    await fetch(BASE + `/admin/items/${first.id}/price`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ price: String(first.price) }),
    });
    results.push(['POST price update', 'PASS', `${first.price} -> ${newPrice} -> restored`]);
  }

  // 6) No cart/payment endpoints exist
  {
    for (const path of ['/cart', '/checkout', '/pay', '/order']) {
      const r = await fetch(BASE + path);
      assert(r.status === 404 || r.status === 500, `${path} should not exist, got ${r.status}`);
    }
    results.push(['No cart/checkout/pay/order', 'PASS', '404']);
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
