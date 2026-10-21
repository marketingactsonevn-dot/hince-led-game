// v2.7 end-to-end checks in Chromium (Playwright): real flow RESULT → FORM → RECEIPT, stock, records, duplicate, v2.6 migration,
// file:// without console errors, offline via the service worker. Run from the repo root:  NODE_PATH=$(npm root -g) node _dev/tests/flow_v27.js
const path = require('path'), http = require('http'), fs = require('fs'), assert = require('assert');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webmanifest': 'application/manifest+json' };
let online = true;
const srv = http.createServer((q, r) => {
  if (!online) { r.destroy(); return; }
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
});
let passed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('  FAIL ' + name + '\n    ' + (e && e.stack || e)); process.exitCode = 1; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  async function open(url, pre, opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1080, height: 1920 } }, opts || {}));
    if (pre) await ctx.addInitScript(pre);
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/attract\.mp4|promo\.mp4|assets\/audio|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.goto(url);
    await p.waitForFunction(() => window.App && App.assetsReady, null, { timeout: 15000 });
    return { p, ctx, errs };
  }
  // play: force a raw score through the real endGame (same path as a finished game), then tap through like a customer
  async function play(p, game, raw, max, phone) {
    await p.evaluate(([g, raw, max]) => { App.debug.toReady(g); App.debug.endGame({ score: raw, max: max, seed: 5, difficulty: 'normal' }); }, [game, raw, max]);
    await p.waitForFunction(() => App.screen === 'result'); await sleep(3400); // count-up 1.2 s + reveal (a tap before that only skips the effect)
    const res = await p.evaluate(() => ({ r: App.result, score: document.getElementById('res-score').textContent, gift: document.getElementById('rg-name').textContent, rev: document.getElementById('s-result').className }));
    await p.click('#res-next'); await p.waitForFunction(() => App.screen === 'form');
    await sleep(500);
    for (const c of 'AN NGUYEN') await p.click('#kb [data-k="' + c + '"]');
    await p.click('#kb [data-k="NEXT"]');
    for (const c of phone) await p.click('#kb [data-k="' + c + '"]');
    await p.click('[data-consent="gift"]');
    await p.click('#form-submit'); await p.waitForFunction(() => App.screen === 'reward');
    const rec = await p.evaluate(() => Object.assign({}, App.record, { receiptGift: document.getElementById('rw-gname').textContent, receiptScore: document.getElementById('rw-r-score').textContent }));
    return { res, rec };
  }

  console.log('FLOW (http, Chromium 1080x1920)');
  const { p, errs } = await open(base + 'index.html');
  await t('first run: event stock 500 / 200 / 100 / 50, settings 70 / 90, version 2.8.0, idle screen in English', async () => {
    const o = await p.evaluate(() => ({ st: Store.giftStock(), th: App.settings.thresholds, v: App.settings.appVersion, lang: I18N.lang, def: App.settings.defaultLang }));
    assert.strictEqual(o.lang, 'en'); assert.strictEqual(o.def, 'en');
    assert.deepStrictEqual(o.st, { hairTie: 500, mirror: 200, mini: 100, full: 50 }); assert.deepStrictEqual(o.th, { mid: 70, high: 90 }); assert.strictEqual(o.v, '2.8.0');
  });
  let full;
  await t('score 96/100 → full-size: result shows 96 + gift, receipt keeps the same gift, stock −1', async () => {
    full = await play(p, 'umpah', 1440, 1500, '0901111111');
    assert.strictEqual(full.res.score, '96'); assert.strictEqual(full.res.r.pick.giftKey, 'full'); assert(/rev/.test(full.res.rev));
    assert.strictEqual(full.rec.giftKey, 'full'); assert.strictEqual(full.rec.tier, 3); assert.strictEqual(full.rec.scorePct, 96); assert.strictEqual(full.rec.score, 1440);
    assert.strictEqual(full.rec.maxScore, 1500); assert.strictEqual(full.rec.giftName, 'hince Nu Blur Tint'); assert.strictEqual(full.rec.receiptGift, 'hince Nu Blur Tint');
    assert.strictEqual(full.rec.receiptScore, '96 / 100'); assert.strictEqual(full.rec.appVersion, '2.8.0');
    assert.strictEqual((await p.evaluate(() => Store.giftStock())).full, 49);
  });
  await t('score 78 → Mini; 40 → Hair Tie or Mirror; stock follows', async () => {
    await p.evaluate(() => App.home());
    const a = await play(p, 'taptap2', 1092, 1400, '0902222222');
    assert.strictEqual(a.rec.giftKey, 'mini'); assert.strictEqual(a.rec.tier, 2); assert.strictEqual(a.rec.scorePct, 78);
    await p.evaluate(() => App.home());
    const b = await play(p, 'umpah2', 400, 1000, '0903333333');
    assert(['hairTie', 'mirror'].includes(b.rec.giftKey)); assert.strictEqual(b.rec.tier, 1); assert.strictEqual(b.rec.scorePct, 40);
    assert.strictEqual(b.rec.giftKey, b.res.r.pick.giftKey);
    const st = await p.evaluate(() => Store.giftStock());
    assert.strictEqual(st.mini, 99); assert.strictEqual(st.hairTie + st.mirror, 699);
  });
  await t('same phone again → duplicate (no gift, no stock taken)', async () => {
    await p.evaluate(() => App.home());
    const st0 = await p.evaluate(() => Store.giftStock());
    const d = await play(p, 'umpah', 1500, 1500, '0901111111');
    assert.strictEqual(d.res.score, '100'); assert.strictEqual(d.rec.tier, 0); assert.strictEqual(d.rec.reason, 'duplicate');
    assert.deepStrictEqual(await p.evaluate(() => Store.giftStock()), st0);
  });
  await t('full-size stock 0 → 95 gets Mini, receipt says downgraded', async () => {
    await p.evaluate(() => App.home());
    await p.evaluate(() => Store.setGiftStock('full', 0));
    const g = await play(p, 'umpah', 1425, 1500, '0904444444');
    assert.strictEqual(g.res.r.pick.giftKey, 'mini'); assert.strictEqual(g.rec.giftKey, 'mini'); assert.strictEqual(g.rec.reason, 'downgraded');
    assert(/hết|out of stock/i.test(await p.evaluate(() => document.getElementById('rw-note').textContent)));
  });
  await t('everything gone → RESULT says "Quà đã hết", receipt outOfStock', async () => {
    await p.evaluate(() => App.home());
    await p.evaluate(() => ['hairTie', 'mirror', 'mini', 'full'].forEach(k => Store.setGiftStock(k, 0)));
    const g = await play(p, 'taptap2', 300, 1400, '0905555555');
    assert.strictEqual(g.res.r.pick.reason, 'outOfStock'); assert.strictEqual(g.rec.tier, 0); assert.strictEqual(g.rec.reason, 'outOfStock');
    assert.strictEqual(await p.evaluate(() => document.getElementById('s-result').getAttribute('data-tier')), '0');
  });
  await t('CSV / Sheet row keeps the 23 v2.6 columns; values: scorePct 0–100, tier 1–3, giftName', async () => {
    const csv = await p.evaluate(() => Logic.toCSV(Store.records()));
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    assert.strictEqual(lines[0].split(',').length, 23);
    assert(lines[1].includes(',96,3,hince Nu Blur Tint,'), lines[1]);
  });
  await t('tap during the reveal skips to the final state (NHẬN QUÀ not pressed by that tap)', async () => {
    await p.evaluate(() => { App.home(); ['hairTie', 'mirror', 'mini', 'full'].forEach(k => Store.setGiftStock(k, 10)); App.debug.toReady('umpah'); App.debug.endGame({ score: 1200, max: 1500, seed: 1 }); });
    await p.waitForFunction(() => App.screen === 'result'); await sleep(700);
    await p.mouse.click(540, 1655); // on the NHẬN QUÀ button, mid count-up
    await sleep(150);
    const o = await p.evaluate(() => ({ s: App.screen, cls: document.getElementById('s-result').className, sc: document.getElementById('res-score').textContent }));
    assert.strictEqual(o.s, 'result'); assert(/rev-end/.test(o.cls), o.cls); assert.strictEqual(o.sc, '80');
  });
  await t('HUD shows 0–100 while playing (Um-Pah! 1: one real matched pair by touch)', async () => {
    await p.evaluate(() => { App.home(); App.debug.toReady('umpah'); App.debug.startGame(); });
    await p.waitForFunction(() => document.getElementById('s-umpah').getAttribute('data-st') === 'ready', null, { timeout: 15000 });
    const [i, j] = await p.evaluate(() => { const d = App.session.deck, i = 0; return [i, d.indexOf(d[i], 1)]; });
    await p.click('#m-grid .m-card[data-i="' + i + '"]'); await p.click('#m-grid .m-card[data-i="' + j + '"]');
    await sleep(900);
    const o = await p.evaluate(() => ({ hud: document.getElementById('m-score').textContent, raw: App.session.score, max: App.session.max, band: document.getElementById('m-band-s').textContent }));
    assert(o.raw > 0, 'no points'); assert.strictEqual(+o.hud, Math.round(100 * o.raw / o.max)); assert(+o.hud <= 100);
    assert.strictEqual(o.band, '+' + o.hud);
    await p.evaluate(() => App.home());
  });
  await t('keyboards (name VI, name EN, phone VI / EN) stay inside the clipboard paper, >= 32 px each side, keys >= 64 px tall', async () => {
    for (const lang of ['vi', 'en']) {
      await p.evaluate(l => { App.home(); I18N.set(l); App.debug.toReady('umpah'); App.debug.endGame({ score: 900, max: 1500, seed: 1 }); }, lang);
      await p.waitForFunction(() => App.screen === 'result'); await p.evaluate(() => App.debug.toForm()); await sleep(500); // past the ghost-click guard
      for (const focus of ['name', 'phone']) {
        await p.click('[data-field="' + focus + '"]');
        const o = await p.evaluate(() => {
          const b = document.querySelector('#s-form .fm-board').getBoundingClientRect(), keys = [...document.querySelectorAll('#kb .key')].map(k => k.getBoundingClientRect());
          const clipped = [...document.querySelectorAll('#kb .key')].filter(k => k.scrollWidth > k.clientWidth + 1).map(k => k.textContent);
          return { L: b.left, R: b.right, minL: Math.min(...keys.map(k => k.left)), maxR: Math.max(...keys.map(k => k.right)), minH: Math.min(...keys.map(k => k.height)), n: keys.length, clipped };
        });
        assert(o.minL - o.L >= 32 && o.R - o.maxR >= 32, lang + ' ' + focus + ' ' + JSON.stringify(o));
        assert(o.minH >= 64, 'key height ' + o.minH); assert.deepStrictEqual(o.clipped, [], lang + ' ' + focus + ' label cut');
        console.log(`      ${lang} ${focus}: ${o.n} keys, margin left ${Math.round(o.minL - o.L)} px / right ${Math.round(o.R - o.maxR)} px`);
      }
    }
    await p.evaluate(() => { App.home(); I18N.set('vi'); });
  });
  await t('Control Center (v2.7.1): PIN 2026, 5 tabs, a staff choice of VI as default language is kept', async () => {
    await p.evaluate(() => { App.home(); Admin.open(); });
    for (const k of '2026') await p.click('[data-pin="' + k + '"]');
    const tabs = await p.$$eval('#cc-tabs button', b => b.map(x => x.getAttribute('data-tab')));
    assert.deepStrictEqual(tabs, ['overview', 'gifts', 'games', 'data', 'system']);
    for (const t of tabs) { await p.click('#cc-tabs [data-tab="' + t + '"]'); assert(await p.$eval('#admin-panel', e => e.children.length > 0)); }
    await p.click('[data-deflang="vi"]');
    assert.strictEqual(await p.evaluate(() => Store.settings().defaultLang), 'vi');
    await p.click('[data-deflang="en"]');
    await p.click('#cc-close'); assert.strictEqual(await p.evaluate(() => I18N.lang), 'en');
  });
  await t('brand type (v2.8): titles ask for Constantia, bundled Gelasio is loaded with Vietnamese; labels are Be Vietnam Pro; gift code mono', async () => {
    await p.evaluate(() => App.home());
    const o = await p.evaluate(async () => {
      await document.fonts.load('italic 700 40px Gelasio', 'BLUR Ắ'); await document.fonts.load('400 40px Gelasio', 'Cảm ơn');
      const ff = id => getComputedStyle(document.querySelector(id)).fontFamily;
      return { t2: ff('#s-attract .at-t2'), eb: ff('#s-attract .at-eb'), code: ff('#rw-code'),
        gel: document.fonts.check('italic 700 40px Gelasio', 'Ắ') && document.fonts.check('400 40px Gelasio', 'ơ') };
    });
    assert(/^Constantia, "?Gelasio"?/.test(o.t2), o.t2); assert(/Be Vietnam Pro/.test(o.eb), o.eb); assert(/IBM Plex Mono/.test(o.code), o.code); assert(o.gel, 'Gelasio not loaded');
  });
  await t('no page errors (http)', async () => assert.deepStrictEqual(errs, []));

  console.log('MIGRATION (a v2.6 kiosk)');
  const v26 = () => {
    if (localStorage.getItem('mig_done')) return; localStorage.setItem('mig_done', '1');
    localStorage.setItem('hince_led_stock_v1', JSON.stringify({ date: '2026-11-27', tier1: 37, tier2: 4 }));
    localStorage.setItem('hince_led_settings_v1', JSON.stringify({ appVersion: '2.4.0', thresholds: { umpah: { tier1: 45, tier2: 70 }, taptap: { tier1: 40, tier2: 75 }, umpah2: { tier1: 45, tier2: 70 }, taptap2: { tier1: 45, tier2: 70 } },
      dailyStock: { tier1: 100, tier2: 20 }, defaultLang: 'vi', gifts: { tier1: 'Quà Mức 1', tier2: 'Quà Mức 2' }, giftsEn: { tier1: 'L1', tier2: 'L2' }, sound: false, kioskName: 'LED-2', adminPin: '1234' }));
    localStorage.setItem('hince_led_records_v1', JSON.stringify([{ id: 'old1', phone: '0907777777', tier: 1, date: '2026-11-27', testMode: false, giftName: 'Quà Mức 1', scorePct: 52.3 }]));
  };
  const m = await open(base + 'index.html', v26);
  await t('v2.6 stock {tier1, tier2} → v2.7 defaults (not added up), old key removed', async () => {
    const o = await m.p.evaluate(() => ({ st: Store.giftStock(), old: localStorage.getItem('hince_led_stock_v1') }));
    assert.deepStrictEqual(o.st, { hairTie: 500, mirror: 200, mini: 100, full: 50 }); assert.strictEqual(o.old, null);
  });
  await t('v2.6 settings: old thresholds / dailyStock / tier gift names dropped, the rest kept', async () => {
    const s = await m.p.evaluate(() => App.settings);
    assert.deepStrictEqual(s.thresholds, { mid: 70, high: 90 }); assert.strictEqual(s.dailyStock, undefined);
    assert.strictEqual(s.gifts.hairTie, 'hince Hair Tie'); assert.strictEqual(s.gifts.tier1, undefined);
    assert.strictEqual(s.sound, false); assert.strictEqual(s.kioskName, 'LED-2'); assert.strictEqual(s.adminPin, '1234'); assert.strictEqual(s.appVersion, '2.8.0'); assert.strictEqual(s.defaultLang, 'en'); // v2.6 saved 'vi' without anyone choosing it
  });
  await t('a phone that got a v2.6 gift is still a duplicate in v2.7', async () => {
    const d = await play(m.p, 'umpah', 1500, 1500, '0907777777');
    assert.strictEqual(d.rec.reason, 'duplicate');
  });
  await t('no page errors (migration)', async () => assert.deepStrictEqual(m.errs, []));

  console.log('file:// and offline');
  const f = await open('file://' + path.join(ROOT, 'index.html'));
  await t('file:// opens, a full round works, no console errors', async () => {
    const r = await play(f.p, 'taptap', 5000, 10000, '0908888888');
    assert.strictEqual(r.rec.scorePct, 50); assert.strictEqual(r.rec.tier, 1);
    assert.deepStrictEqual(f.errs, []);
  });
  await t('service worker caches v2.8 (hince-led-v2.8) and the app opens offline', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
    const q = await ctx.newPage();
    await q.goto(base + 'index.html');
    await q.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || false, null, { timeout: 30000 }).catch(() => {});
    await q.evaluate(() => navigator.serviceWorker.ready);
    await sleep(1500);
    const keys = await q.evaluate(async () => { const k = await caches.keys(); const c = await caches.open(k[0]); return { k, n: (await c.keys()).length, gift: !!(await c.match('./assets/v27/gifts/nu_blur_full.webp')), bg: !!(await c.match('./assets/v27/bg/bg_rose_paper.jpg')) }; });
    assert.deepStrictEqual(keys.k, ['hince-led-v2.8']); assert(keys.gift && keys.bg, JSON.stringify(keys));
    online = false;
    await q.reload(); await q.waitForFunction(() => window.App && App.assetsReady, null, { timeout: 15000 });
    assert.strictEqual(await q.evaluate(() => App.settings.appVersion), '2.8.0');
    assert(await q.evaluate(() => getComputedStyle(document.getElementById('stage')).backgroundImage.includes('bg_rose_paper')));
    online = true; await ctx.close();
  });
  await browser.close(); srv.close();
  console.log(`\n${passed} flow checks passed` + (process.exitCode ? ' — SOME FAILED' : ''));
})().catch(e => { console.error(e); process.exit(1); });
