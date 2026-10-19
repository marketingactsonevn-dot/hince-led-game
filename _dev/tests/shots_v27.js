// v2.7 screenshots (1080x1920 JPEG q88) with Playwright Chromium. Not part of the app.
// Run from the repo root:  NODE_PATH=$(npm root -g) node _dev/tests/shots_v27.js [rootDir] [outDir] [prefix]
//   rootDir = folder served (default: repo root), outDir = where PNGs go (default _dev/report_v2_7/shots), prefix = file name prefix
// Drives the app through App.debug (no real touches needed); "before" shots use the same script on an old checkout.
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const OUT = path.resolve(process.argv[3] || path.join(__dirname, '..', 'report_v2_7', 'shots'));
const PRE = process.argv[4] || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), base = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch();
  const errors = [];
  async function page(lang) {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await p.goto(base);
    await p.waitForFunction(() => window.App && App.assetsReady, null, { timeout: 15000 });
    await p.evaluate(() => document.fonts.ready);
    if (lang) await p.evaluate(l => I18N.set(l), lang);
    return p;
  }
  async function shot(p, name) { if (ONLY.length && !ONLY.some(o => name.indexOf(o) >= 0)) return; await p.screenshot({ path: path.join(OUT, PRE + name + '.jpg'), type: 'jpeg', quality: 88 }); console.log('  shot ' + PRE + name); }
  const v27 = async p => p.evaluate(() => !!(App.debug && App.debug.showResultFor));

  // 1 attract (flyer: there is no attract video in the repo)
  let p = await page();
  await sleep(600); await shot(p, '01_attract');
  // 2 ready / how to play, one per game type (the countdown would start the game: shoot early)
  for (const g of ['umpah', 'taptap']) {
    await p.evaluate(g => App.debug.toReady(g), g); await sleep(900); await shot(p, '02_ready_' + g);
    await p.evaluate(() => App.home());
  }
  // 3 playing (one per game)
  for (const g of ['umpah', 'umpah2', 'taptap', 'taptap2']) {
    await p.evaluate(g => { App.debug.toReady(g); App.debug.startGame(); }, g);
    await sleep(g === 'umpah' ? 6500 : 2500); await shot(p, '03_play_' + g);
    await p.evaluate(() => App.home());
  }
  // 4 result for the four gifts (v2.7: forced score100 via App.debug.showResultFor) / v2.6: raw scores
  const isNew = await v27(p);
  if (isNew) {
    for (const [k, sc] of [['hairTie', 52], ['mirror', 61], ['mini', 78], ['full', 96]]) {
      await p.evaluate(([k, sc]) => App.debug.showResultFor('umpah', sc, k), [k, sc]);
      await sleep(3600); await shot(p, '04_result_' + k);
    }
    // mid-animation frames (confetti in the air): Mini (medium) and full-size (strongest: more confetti + sparkle stickers)
    await p.evaluate(() => App.debug.showResultFor('taptap', 88, 'mini')); await sleep(2250); await shot(p, '04_result_anim_mini');
    await p.evaluate(() => App.debug.showResultFor('taptap2', 97, 'full')); await sleep(2250); await shot(p, '04_result_anim_full');
    await p.evaluate(() => App.debug.showResultFor('umpah', 45, 'hairTie')); await sleep(2250); await shot(p, '04_result_anim_hairTie');
    await p.evaluate(() => App.debug.showResultFor('umpah2', 40, '')); await sleep(3000); await shot(p, '04_result_soldout');
  } else {
    for (const [k, sc] of [['t2', 1300], ['t1', 900], ['t0', 300]]) {
      await p.evaluate(sc => { App.debug.toReady('umpah'); App.debug.endGame({ score: sc, max: 1500, seed: 1, difficulty: 'normal' }); }, sc);
      await sleep(2600); await shot(p, '04_result_' + k);
    }
  }
  // 5 form: name keyboard (VI), phone pad (VI), then EN
  await p.evaluate(() => { App.home(); App.debug.toReady('umpah'); App.debug.endGame({ score: 1400, max: 1500, seed: 1, difficulty: 'normal' }); });
  await sleep(900);
  await p.evaluate(() => App.debug.toForm()); await sleep(600); await shot(p, '05_form_name_vi');
  await p.evaluate(() => { App.form.name = 'NGUYEN VAN A'; App.form.focus = 'phone'; App.form.phone = '0901234567'; document.querySelector('#f-phone').click(); });
  await sleep(500); await shot(p, '05_form_phone_vi');
  await p.close();
  p = await page('en');
  await p.evaluate(() => { App.debug.toReady('taptap'); App.debug.endGame({ score: 1400, max: 1500, seed: 1, difficulty: 'normal' }); });
  await sleep(900);
  await p.evaluate(() => App.debug.toForm()); await sleep(600); await shot(p, '05_form_name_en');
  await p.evaluate(() => { App.form.name = 'JANE DOE'; document.querySelector('#f-phone').click(); });
  await sleep(500); await shot(p, '05_form_phone_en');
  await p.close();
  // 6 reward receipt: the four gifts (v2.7) / two levels (v2.6), then the duplicate / out of stock receipt
  p = await page();
  const now = new Date().toISOString().slice(0, 19) + '+07:00';
  const recs = isNew ? [['hairTie', 1, 55], ['mirror', 1, 64], ['mini', 2, 81], ['full', 3, 97]] : [['t1', 1, 900], ['t2', 2, 1300]];
  for (const [k, tier, sc] of recs) {
    await p.evaluate(([k, tier, sc, now]) => {
      App.debug.toReady('umpah'); App.home(); App.game = 'umpah';
      const rec = { id: 'x', createdAt: now, game: 'umpah', score: sc * 15, maxScore: 1500, scorePct: sc, tier: tier, reason: '', name: 'NGUYEN VAN A', rewardCode: 'U-00' + (10 + tier) };
      if (App.debug.giftRec) App.debug.giftRec(rec, k); else rec.giftName = 'Quà Mức ' + tier;
      App.record = rec; App.debug.toReward(rec, true);
    }, [k, tier, sc, now]);
    await sleep(800); await shot(p, '06_reward_' + k);
  }
  await p.evaluate(now => { const rec = { id: 'y', createdAt: now, game: 'taptap', score: 4000, maxScore: 9000, scorePct: 44, tier: 0, reason: 'outOfStock', name: 'TRAN B', rewardCode: '' }; App.game = 'taptap'; App.debug.toReward(rec, true); }, now);
  await sleep(800); await shot(p, '06_reward_soldout');
  // 7 thanks
  await p.evaluate(() => { App.game = 'umpah'; App.debug.toThanks('NGUYEN VAN A'); }); await sleep(700); await shot(p, '07_thanks');
  await p.evaluate(() => App.home());
  // 8 Control Center: PIN, then the gifts section
  await p.evaluate(() => Admin.open());
  for (const k of '2026') await p.click('[data-pin="' + k + '"]');
  await sleep(400); await shot(p, '08_cc_top');
  await p.evaluate(() => { const h = [...document.querySelectorAll('#admin-panel h3')].find(x => /QUÀ|GIFT/.test(x.textContent)); if (h) document.getElementById('admin-panel').scrollTop = h.offsetTop - 20; });
  await sleep(400); await shot(p, '08_cc_gifts');
  await p.close();
  await browser.close(); srv.close();
  if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; } else console.log('no page errors');
})().catch(e => { console.error(e); process.exit(1); });
