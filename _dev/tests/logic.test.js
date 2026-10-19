// Run: node _dev/tests/logic.test.js
const assert = require('assert');
const L = require('../../js/logic.js');
let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('  FAIL ' + name + '\n    ' + e.message); process.exitCode = 1; } }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

console.log('UM-PAH PRESS');
t('max score = 2200', () => assert.strictEqual(L.umpahMax(), 2200));
t('round params ramp and stay in bounds', () => {
  for (let s = 1; s < 300; s++) {
    const r = L.rng(s);
    for (let i = 0; i < 10; i++) {
      const R = L.umpahRound(i, r);
      assert(R.zoneDeg >= 26 && R.zoneDeg <= 70);
      assert(R.periodMs >= 1300 && R.periodMs <= 2400);
      // zone never comes within 50deg of the start (quick-tap protection)
      for (let ms = 0; ms < 6000; ms += 50) {
        const c = L.umpahZoneCenter(R, ms);
        const forward = ((c * R.dir) % 360 + 360) % 360; // distance travelled by marker to reach zone centre
        assert(forward - R.zoneDeg / 2 > 50, 'zone too close to start s=' + s + ' i=' + i);
      }
    }
  }
});
t('releasing exactly at zone centre = perfect', () => {
  const R = L.umpahRound(0, L.rng(5));
  // find hold time where marker hits centre
  const target = ((R.zoneCenter0 * R.dir) % 360 + 360) % 360;
  const hold = target / 360 * R.periodMs;
  assert.strictEqual(L.umpahJudge(R, hold, hold + 300).result, 'perfect');
});
t('quick tap (<=250ms) never scores, any seed/round', () => {
  for (let s = 1; s < 500; s++) {
    const S = new L.UmpahSession(s);
    while (!S.done()) { const j = S.release(150 + (s % 100), 400); assert.strictEqual(j.result, 'miss'); }
    assert.strictEqual(S.score, 0);
  }
});
t('holding > 2 loops = miss', () => {
  const R = L.umpahRound(0, L.rng(1));
  assert.strictEqual(L.umpahJudge(R, R.periodMs * 2 + 1, 5000).result, 'miss');
});
t('perfect play reaches max', () => {
  const S = new L.UmpahSession(42);
  let since = 1000;
  while (!S.done()) {
    const R = S.current;
    // search hold that is perfect
    let ok = false;
    for (let h = 0; h < R.periodMs * 2; h += 2) {
      if (L.umpahJudge(R, h, since + h).result === 'perfect') { S.release(h, since + h); ok = true; break; }
    }
    assert(ok);
  }
  assert.strictEqual(S.score, 2200);
});

function simUmpah(seed, sdMs, reactionMs) {
  // human-like: watches marker, releases when it predicts centre, with gaussian timing noise
  const S = new L.UmpahSession(seed); const r = L.rng(seed * 7 + 1);
  while (!S.done()) {
    const R = S.current; const startWait = 600 + r() * 800;
    let best = null;
    for (let h = 0; h < R.periodMs * 2; h += 5) {
      const d = Math.abs(L.normDeg(L.umpahMarker(R, h) - L.umpahZoneCenter(R, startWait + h)));
      if (d < 2) { best = h; break; }
    }
    if (best === null) best = R.periodMs * 0.5;
    const h = best + gauss(r) * sdMs + reactionMs;
    S.release(h, startWait + h);
  }
  return L.pct(S.score, S.max);
}
t('distribution (report)', () => {
  for (const [label, sd] of [['skilled sd35', 35], ['average sd70', 70], ['casual sd120', 120]]) {
    const arr = []; for (let s = 1; s <= 400; s++) arr.push(simUmpah(s, sd, 0));
    arr.sort((a, b) => a - b);
    const p = q => arr[Math.floor(q * (arr.length - 1))];
    const t1 = arr.filter(x => x >= 45).length / arr.length, t2 = arr.filter(x => x >= 70).length / arr.length;
    console.log(`      ${label}: median ${p(.5)}%  p10 ${p(.1)}%  p90 ${p(.9)}%  >=45%: ${(t1 * 100).toFixed(0)}%  >=70%: ${(t2 * 100).toFixed(0)}%`);
  }
});

console.log('GLOW TILES');
t('chart sane for many seeds', () => {
  for (let s = 1; s < 300; s++) {
    const c = L.buildChart(s);
    assert(c.length > 50 && c.length < 100, 'notes ' + c.length);
    assert(c.every(n => n.t >= 1600 && n.t <= 29000 && n.lane >= 0 && n.lane < 4));
    for (let i = 1; i < c.length; i++) assert(c[i].t >= c[i - 1].t);
    // pairs never share lane
    for (let i = 1; i < c.length; i++) if (c[i].t === c[i - 1].t) assert(c[i].lane !== c[i - 1].lane);
  }
});
function perfectPlay(seed, goldDouble = true) {
  const S = new L.TilesSession(seed);
  const evs = [];
  S.notes.forEach(n => { evs.push({ t: n.t, lane: n.lane }); if (n.gold && goldDouble) evs.push({ t: n.t + 150, lane: n.lane }); });
  evs.sort((a, b) => a.t - b.t);
  for (const e of evs) { S.update(e.t); S.tap(e.lane, e.t); }
  S.update(31000);
  return S;
}
t('perfect play = max, no misses', () => {
  for (let s = 1; s < 100; s++) {
    const S = perfectPlay(s);
    assert.strictEqual(S.score, S.max, 'seed ' + s);
    assert.strictEqual(S.stats.miss, 0); assert.strictEqual(S.stats.empty, 0);
  }
});
t('gold without double tap gives less', () => {
  const S = perfectPlay(3, false); assert(S.score < S.max);
});
t('spam all lanes every 50ms -> ~0 points', () => {
  for (let s = 1; s < 50; s++) {
    const S = new L.TilesSession(s);
    for (let tt = 0; tt < 30000; tt += 50) { S.update(tt); for (let l = 0; l < 4; l++) S.tap(l, tt); }
    S.update(31000);
    assert(L.pct(S.score, S.max) < 10, 'spam got ' + L.pct(S.score, S.max) + '%');
  }
});
t('ghost duplicate tap (<40ms) ignored', () => {
  const S = new L.TilesSession(9); const n = S.notes[0];
  S.tap(n.lane, n.t); const e = S.tap(n.lane, n.t + 20);
  assert.strictEqual(e, null); assert.strictEqual(S.stats.empty, 0);
});
t('note passing unhit = miss and combo reset', () => {
  const S = new L.TilesSession(9); S.update(5000); assert(S.stats.miss > 0); assert.strictEqual(S.combo, 0);
});
function simTiles(seed, sdMs, hitRate, goldRate) {
  const S = new L.TilesSession(seed); const r = L.rng(seed * 13 + 5); const evs = [];
  S.notes.forEach(n => {
    if (r() > hitRate) return;
    const tt = n.t + gauss(r) * sdMs; evs.push({ t: tt, lane: n.lane });
    if (n.gold && r() < goldRate) evs.push({ t: tt + 160 + r() * 120, lane: n.lane });
  });
  evs.sort((a, b) => a.t - b.t);
  for (const e of evs) { S.update(e.t); S.tap(e.lane, e.t); }
  S.update(31000);
  return L.pct(S.score, S.max);
}
t('distribution (report)', () => {
  for (const [label, sd, hr, gr] of [['skilled', 40, .97, .9], ['average', 65, .88, .7], ['casual', 95, .75, .5]]) {
    const arr = []; for (let s = 1; s <= 400; s++) arr.push(simTiles(s, sd, hr, gr));
    arr.sort((a, b) => a - b);
    const p = q => arr[Math.floor(q * (arr.length - 1))];
    const t1 = arr.filter(x => x >= 45).length / arr.length, t2 = arr.filter(x => x >= 70).length / arr.length;
    console.log(`      ${label}: median ${p(.5)}%  p10 ${p(.1)}%  p90 ${p(.9)}%  >=45%: ${(t1 * 100).toFixed(0)}%  >=70%: ${(t2 * 100).toFixed(0)}%`);
  }
});

console.log('REWARD & DATA');
// ---- v2.7: score 0–100, 3 tiers, event gift stock (TASK_v2_7 §2) ----
const FULL = { hairTie: 500, mirror: 200, mini: 100, full: 50 };
const TH = { mid: 70, high: 90 };
t('score100: 0–100, rounded, clamped, 100 only for a perfect game', () => {
  assert.strictEqual(L.score100(0, 1500), 0); assert.strictEqual(L.score100(1500, 1500), 100);
  assert.strictEqual(L.score100(1499, 1500), 99); // rounds to 100 but is not perfect
  assert.strictEqual(L.score100(1050, 1500), 70); assert.strictEqual(L.score100(1042, 1500), 69); // 69.47 → 69
  assert.strictEqual(L.score100(1043, 1500), 70); // 69.53 → 70
  assert.strictEqual(L.score100(-50, 1500), 0); assert.strictEqual(L.score100(2000, 1500), 100);
  assert.strictEqual(L.score100(10, 0), 0);
  // every game's own max (umpahMax, chartMax) maps to 100
  assert.strictEqual(L.score100(L.umpahMax(), L.umpahMax()), 100);
  const S = new L.TilesSession(77); assert.strictEqual(L.score100(S.max, S.max), 100);
});
t('tierFor100: 0–69 → 1, 70–89 → 2, 90–100 → 3 (everyone gets a gift)', () => {
  [0, 1, 50, 69].forEach(v => assert.strictEqual(L.tierFor100(v, TH), 1, v));
  [70, 75, 89].forEach(v => assert.strictEqual(L.tierFor100(v, TH), 2, v));
  [90, 95, 100].forEach(v => assert.strictEqual(L.tierFor100(v, TH), 3, v));
  assert.strictEqual(L.tierFor100(60, { mid: 60, high: 80 }), 2); assert.strictEqual(L.tierFor100(80, { mid: 60, high: 80 }), 3);
});
t('pickGift: tier 3 → full, tier 2 → mini, tier 1 → hair tie / mirror', () => {
  assert.deepStrictEqual(L.pickGift(3, FULL, () => 0.5), { tier: 3, giftKey: 'full', reason: '' });
  assert.deepStrictEqual(L.pickGift(2, FULL, () => 0.5), { tier: 2, giftKey: 'mini', reason: '' });
  assert.strictEqual(L.pickGift(1, FULL, () => 0).giftKey, 'hairTie');
  assert.strictEqual(L.pickGift(1, FULL, () => 0.999).giftKey, 'mirror');
  assert.strictEqual(L.pickGift(1, FULL, () => 0.5).reason, '');
});
t('pickGift fallback: full out → mini, mini out → hair tie / mirror, never above the tier', () => {
  assert.deepStrictEqual(L.pickGift(3, { ...FULL, full: 0 }, () => 0.5), { tier: 2, giftKey: 'mini', reason: 'downgraded' });
  const p = L.pickGift(3, { ...FULL, full: 0, mini: 0 }, () => 0.1);
  assert.deepStrictEqual(p, { tier: 1, giftKey: 'hairTie', reason: 'downgraded' });
  assert.strictEqual(L.pickGift(2, { ...FULL, mini: 0 }, () => 0.9).tier, 1);
  // never higher than earned, whatever is left
  for (let i = 0; i < 200; i++) {
    const st = { hairTie: i % 3, mirror: i % 2, mini: i % 5, full: i % 7 };
    for (const t of [1, 2, 3]) { const g = L.pickGift(t, st, Math.random); assert(g.tier <= t); if (g.giftKey) { assert.strictEqual(L.GIFT_TIER[g.giftKey], g.tier); assert(st[g.giftKey] > 0); } }
  }
});
t('pickGift: one of hair tie / mirror gone → only the other; both gone → outOfStock', () => {
  for (let i = 0; i < 50; i++) assert.strictEqual(L.pickGift(1, { ...FULL, hairTie: 0 }, Math.random).giftKey, 'mirror');
  for (let i = 0; i < 50; i++) assert.strictEqual(L.pickGift(1, { ...FULL, mirror: 0 }, Math.random).giftKey, 'hairTie');
  const none = { hairTie: 0, mirror: 0, mini: 0, full: 0 };
  [1, 2, 3].forEach(t => assert.deepStrictEqual(L.pickGift(t, none, Math.random), { tier: 0, giftKey: '', reason: 'outOfStock' }));
  // tier 3 with only tier-1 gifts left still gets one (downgraded); missing / negative counts = 0
  assert.strictEqual(L.pickGift(3, { hairTie: 0, mirror: 3 }, Math.random).giftKey, 'mirror');
  assert.strictEqual(L.pickGift(1, { hairTie: -4, mirror: 0 }, Math.random).reason, 'outOfStock');
});
t('pickGift tier 1: random weighted by stock left (10 000 seeded draws, ±3 %)', () => {
  for (const [h, m] of [[500, 200], [200, 200], [30, 270], [1, 0]]) {
    const r = L.rng(2027); let nh = 0;
    for (let i = 0; i < 10000; i++) if (L.pickGift(1, { hairTie: h, mirror: m, mini: 0, full: 0 }, r).giftKey === 'hairTie') nh++;
    const want = h / (h + m), got = nh / 10000;
    assert(Math.abs(got - want) <= 0.03, `hairTie ${h}/${m}: ${got} vs ${want}`);
  }
});
t('pickGift tier 1 drawing down the stock: hair tie and mirror run out together', () => {
  const r = L.rng(7), st = { hairTie: 500, mirror: 200, mini: 0, full: 0 }; let lastH = -1, lastM = -1, n = 0;
  while (st.hairTie + st.mirror > 0) { const g = L.pickGift(1, st, r); st[g.giftKey]--; n++; if (!st.hairTie && lastH < 0) lastH = n; if (!st.mirror && lastM < 0) lastM = n; }
  assert.strictEqual(n, 700);
  assert(Math.min(lastH, lastM) > 640, 'one gift ran out at ' + Math.min(lastH, lastM) + ' / 700'); // the first one runs out near the end
});
t('resolveReward: keeps the gift picked on RESULT; re-picks only when it is gone', () => {
  const b = { phone: '0901234567', records: [], rule: 'perEvent', today: '2026-11-27', rng: () => 0.5 };
  assert.deepStrictEqual(L.resolveReward(1, { ...b, stock: FULL, giftKey: 'mirror' }), { tier: 1, giftKey: 'mirror', reason: '' });
  assert.deepStrictEqual(L.resolveReward(3, { ...b, stock: FULL, giftKey: 'full' }), { tier: 3, giftKey: 'full', reason: '' });
  assert.deepStrictEqual(L.resolveReward(3, { ...b, stock: FULL, giftKey: 'mini' }), { tier: 2, giftKey: 'mini', reason: 'downgraded' }); // picked while full was out
  assert.deepStrictEqual(L.resolveReward(1, { ...b, stock: { ...FULL, mirror: 0 }, giftKey: 'mirror' }), { tier: 1, giftKey: 'hairTie', reason: '' });
  assert.deepStrictEqual(L.resolveReward(3, { ...b, stock: { ...FULL, full: 0 }, giftKey: 'full' }), { tier: 2, giftKey: 'mini', reason: 'downgraded' });
  assert.deepStrictEqual(L.resolveReward(2, { ...b, stock: { hairTie: 0, mirror: 0, mini: 0, full: 9 }, giftKey: 'mini' }), { tier: 0, giftKey: '', reason: 'outOfStock' });
  // a gift above the score tier is never given (tampered pick)
  assert.deepStrictEqual(L.resolveReward(1, { ...b, stock: FULL, giftKey: 'full' }).tier, 1);
  // no pick: picks now
  assert.deepStrictEqual(L.resolveReward(2, { ...b, stock: FULL }), { tier: 2, giftKey: 'mini', reason: '' });
});
t('duplicate rules (one gift per phone)', () => {
  const rec = [{ phone: '0901234567', tier: 1, date: '2026-11-27', testMode: false }];
  const o = { phone: '0901234567', records: rec, stock: FULL, giftKey: 'mini' };
  assert.deepStrictEqual(L.resolveReward(2, { ...o, rule: 'perEvent', today: '2026-11-28' }), { tier: 0, giftKey: '', reason: 'duplicate' });
  assert.strictEqual(L.resolveReward(2, { ...o, rule: 'perDay', today: '2026-11-28' }).reason, '');
  assert.strictEqual(L.resolveReward(2, { ...o, rule: 'perDay', today: '2026-11-27' }).reason, 'duplicate');
  assert.strictEqual(L.resolveReward(2, { ...o, rule: 'none', today: '2026-11-27' }).reason, '');
  assert.strictEqual(L.resolveReward(2, { ...o, records: [{ ...rec[0], testMode: true }], rule: 'perEvent', today: '2026-11-27' }).reason, '');
  assert.strictEqual(L.resolveReward(2, { ...o, records: [{ ...rec[0], tier: 0 }], rule: 'perEvent', today: '2026-11-27' }).reason, '');
  // duplicate wins over out of stock
  assert.strictEqual(L.resolveReward(2, { ...o, stock: {}, rule: 'perEvent', today: '2026-11-27' }).reason, 'duplicate');
});
t('Sheet columns unchanged in v2.7 (CSV_COLS)', () => {
  assert.deepStrictEqual(L.CSV_COLS, ['createdAt', 'date', 'game', 'score', 'maxScore', 'scorePct', 'tier', 'giftName', 'rewardCode', 'reason',
    'name', 'phone', 'consentGift', 'consentMarketing', 'redeemed', 'redeemedAt', 'testMode', 'seed', 'appVersion', 'id', 'difficulty', 'kiosk', 'lang']);
});
t('phone validation', () => {
  ['0901234567', '0381234567', '0561234567', '0771234567', '0881234567'].forEach(p => assert(L.validPhone(p), p));
  ['090123456', '09012345678', '0101234567', '0201234567', '1901234567', '09O1234567', ''].forEach(p => assert(!L.validPhone(p), p));
  assert.strictEqual(L.formatPhone('0901234567'), '090 123 4567');
});
t('name validation', () => {
  assert(L.validName('NGUYEN VAN A')); assert(L.validName(' LE  ')); assert(!L.validName('A')); assert(!L.validName('')); assert(!L.validName('X'.repeat(41)));
  assert.strictEqual(L.cleanName('  NGUYEN   VAN  A '), 'NGUYEN VAN A');
});
t('csv: BOM, escaping, phone as text', () => {
  const c = L.toCSV([{ name: 'A, "B"', phone: '0901234567', giftName: 'Quà mini', score: 10 }]);
  assert(c.startsWith('﻿')); assert(c.includes('"A, ""B"""')); assert(c.includes('="0901234567"')); assert(c.includes('Quà mini'));
});

console.log(`\n${passed} tests passed` + (process.exitCode ? ' — SOME FAILED' : ''));
