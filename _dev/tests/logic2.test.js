// Run: node _dev/tests/logic2.test.js   (pure logic: Um-Pah! 2 "kiss" + Tap-Tap! 2 "claw" (v2.2), Um-Pah! 1 "memo" (v2.3))
const assert = require('assert');
const L = require('../../js/logic2.js');
let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('  FAIL ' + name + '\n    ' + e.message); process.exitCode = 1; } }

const K = L.KISS, G = L.GRAB, S10 = L.SHADES;
const dE = (a, b) => L.deltaE(a, b);

console.log('UM-PAH! 2 (KISS)');
t('constants as TASK §2.1', () => {
  assert.strictEqual(K.lips, 10); assert.strictEqual(K.activeMs, 30000);
  assert.deepStrictEqual(K.points, { first: 100, second: 40 });
  assert.deepStrictEqual(K.speedBonus, [[1500, 50], [3000, 25]]);
  assert.strictEqual(K.farCount, 3); assert.strictEqual(K.nearMin, 5.5); assert.strictEqual(K.nearMax, 10);
  assert.deepStrictEqual(K.plan, ['FF', 'FF', 'FF', 'NF', 'NF', 'NF', 'NF', 'NN', 'NN', 'NN']);
  assert.deepStrictEqual(S10, ['01_near', '02_dear', '03_nu_allure', '04_figray', '05_hug', '06_nu_rose', '07_heart', '08_wild', '09_cold', '10_leather']);
});
t('deltaE matrix symmetric, matches json samples', () => {
  S10.forEach(a => S10.forEach(b => assert.strictEqual(dE(a, b), dE(b, a))));
  assert.strictEqual(dE('05_hug', '06_nu_rose'), 2.7);
  assert.strictEqual(dE('02_dear', '10_leather'), 16.9);
  assert.strictEqual(dE('03_nu_allure', '09_cold'), 4.7);
});
t('every shade has >= 2 NEAR and exactly 3 FAR', () => {
  S10.forEach(s => {
    const n = L.near(s), f = L.far(s);
    assert(n.length >= 2, s + ' near ' + n.length);
    assert.strictEqual(f.length, 3, s);
    n.forEach(x => assert(dE(s, x) >= 5.5 && dE(s, x) < 10));
    const others = S10.filter(x => x !== s && f.indexOf(x) < 0);
    f.forEach(x => others.forEach(o => assert(dE(s, x) >= dE(s, o))));
    assert(L.decoyPairs(s, 'FF').length > 0 && L.decoyPairs(s, 'NF').length > 0, s + ' has no FF/NF pair');
  });
});
t('10_leather has no valid NN pair, 09_cold exactly 1', () => {
  assert.strictEqual(L.decoyPairs('10_leather', 'NN').length, 0);
  assert.strictEqual(L.decoyPairs('09_cold', 'NN').length, 1);
});
t('each seed shows all 10 shades once; 10_leather never on an NN lip', () => {
  for (let s = 1; s <= 500; s++) {
    const S = new L.Umpah2Session(s);
    assert.deepStrictEqual(S.order.slice().sort(), S10.slice());
    for (let i = 0; i < 10; i++) if (K.plan[i] === 'NN') assert.notStrictEqual(S.order[i], '10_leather', 'seed ' + s);
  }
});
t('plan bands respected, choices distinct, no pair deltaE < 5.5', () => {
  for (let s = 1; s <= 500; s++) {
    const S = new L.Umpah2Session(s);
    for (let i = 0; i < 10; i++) {
      const lip = S.lip();
      assert.strictEqual(lip.i, i); assert.strictEqual(lip.target, S.order[i]);
      const c = lip.choices;
      assert.strictEqual(c.length, 3); assert.strictEqual(new Set(c).size, 3); assert(c.indexOf(lip.target) >= 0);
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) assert(dE(c[a], c[b]) >= 5.5, `seed ${s} lip ${i} ${c[a]}/${c[b]}`);
      const d = c.filter(x => x !== lip.target), N = L.near(lip.target), F = L.far(lip.target);
      const plan = K.plan[i];
      if (plan === 'FF') assert(F.indexOf(d[0]) >= 0 && F.indexOf(d[1]) >= 0);
      if (plan === 'NN') assert(N.indexOf(d[0]) >= 0 && N.indexOf(d[1]) >= 0);
      if (plan === 'NF') assert((N.indexOf(d[0]) >= 0 && F.indexOf(d[1]) >= 0) || (N.indexOf(d[1]) >= 0 && F.indexOf(d[0]) >= 0));
      S.pick(lip.target, 500); S.next();
    }
    assert(S.done());
  }
});
t('tube positions are shuffled (target not always in the same place)', () => {
  const pos = new Set();
  for (let s = 1; s <= 50; s++) { const S = new L.Umpah2Session(s); pos.add(S.lip().choices.indexOf(S.lip().target)); }
  assert.strictEqual(pos.size, 3);
});
t('deterministic per seed', () => {
  const run = s => { const S = new L.Umpah2Session(s), out = []; while (!S.done()) { out.push(S.lip()); S.pick(S.lip().target, 100); S.next(); } return JSON.stringify(out); };
  assert.strictEqual(run(42), run(42));
  assert.notStrictEqual(run(42), run(43));
});
t('scores: first <=1.5s 150, first 2s 125, first slow 100, second 40, missed 0', () => {
  const S = new L.Umpah2Session(7);
  const wrong = () => S.lip().choices.filter(x => x !== S.lip().target)[0];
  let r = S.pick(S.lip().target, 1500); assert.deepStrictEqual(r, { result: 'first', points: 150, lipDone: true, target: S.order[0] }); S.next();
  r = S.pick(S.lip().target, 2000); assert.strictEqual(r.points, 125); assert.strictEqual(r.result, 'first'); S.next();
  r = S.pick(S.lip().target, 3000); assert.strictEqual(r.points, 125); S.next();
  r = S.pick(S.lip().target, 3001); assert.strictEqual(r.points, 100); S.next();
  r = S.pick(wrong(), 500); assert.deepStrictEqual(r, { result: 'wrong', points: 0, lipDone: false, target: S.order[4] });
  r = S.pick(S.lip().target, 600); assert.deepStrictEqual(r, { result: 'second', points: 40, lipDone: true, target: S.order[4] }); S.next();
  const w = S.lip().choices.filter(x => x !== S.lip().target);
  S.pick(w[0], 100); r = S.pick(w[1], 200); assert.deepStrictEqual(r, { result: 'missed', points: 0, lipDone: true, target: S.order[5] }); S.next();
  const w2 = wrong(); S.pick(w2, 100); r = S.pick(w2, 200); assert.strictEqual(r.result, 'missed'); S.next(); // same wrong tube twice = second wrong
  assert.strictEqual(S.score, 150 + 125 + 125 + 100 + 40);
  assert.deepStrictEqual(S.results.slice(0, 8), ['first', 'first', 'first', 'first', 'second', 'missed', 'missed', null]);
  assert.strictEqual(S.pick(S.lip().target, 100).result, 'first');
  assert.strictEqual(S.pick(S.lip().target, 100), null); // resolved lip ignores further picks until next()
});
t('timeUp() ends the session, remaining lips missed', () => {
  const S = new L.Umpah2Session(9);
  S.pick(S.lip().target, 100); S.next();
  S.pick(S.lip().choices.filter(x => x !== S.lip().target)[0], 100);
  S.timeUp();
  assert(S.done()); assert.strictEqual(S.score, 150);
  assert.deepStrictEqual(S.results, ['first'].concat(Array(9).fill('missed')));
  assert.strictEqual(S.pick('01_near', 100), null);
});
t('max = 1500', () => {
  const S = new L.Umpah2Session(1); assert.strictEqual(S.max, 1500); assert.strictEqual(S.seed, 1);
  while (!S.done()) { S.pick(S.lip().target, 0); S.next(); }
  assert.strictEqual(S.score, 1500);
});
t('fuzz 500 seeds: random picks/timeUp never throw, 0 <= score <= max', () => {
  for (let s = 1; s <= 500; s++) {
    const R = L.rng(s * 7919), S = new L.Umpah2Session(s);
    let steps = 0;
    while (!S.done() && steps++ < 200) {
      const x = R();
      if (x < 0.02) S.timeUp();
      else if (x < 0.1) S.next();
      else if (x < 0.15) S.pick(S10[Math.floor(R() * 10)], R() * 6000);
      else S.pick(S.lip().choices[Math.floor(R() * 3)], R() * 6000);
      if (S.lip() && S.results[S.lip().i]) S.next();
      assert(S.score >= 0 && S.score <= S.max, 'seed ' + s);
    }
    assert(S.done(), 'seed ' + s + ' never finished');
    S.results.forEach(r => assert(['first', 'second', 'missed'].indexOf(r) >= 0));
  }
});

console.log('TAP-TAP! 2 (GRAB)');
t('constants as TASK §3.1', () => {
  assert.strictEqual(G.grabs, 7);
  assert.deepStrictEqual(G.slotX, [165, 290, 415, 540, 665, 790, 915]);
  assert.strictEqual(G.railMin, 150); assert.strictEqual(G.railMax, 930);
  assert.strictEqual(G.speedStart, 420); assert.strictEqual(G.speedEnd, 820);
  assert.strictEqual(G.hitHalf, 56); assert.strictEqual(G.perfectPx, 12);
  assert.deepStrictEqual(G.points, { base: 100, centre: 100 }); assert.strictEqual(G.idleMs, 8000);
});
t('clawX stays inside the rail and bounces', () => {
  const S = new L.Taptap2Session(3);
  for (let g = 0; g < 7; g++) {
    const gr = S.grab();
    assert.strictEqual(S.clawX(0), gr.dir > 0 ? 150 : 930);
    let prev = S.clawX(0), turns = 0, lastSign = gr.dir;
    for (let ms = 10; ms < 12000; ms += 10) {
      const x = S.clawX(ms);
      assert(x >= 150 && x <= 930, 'x ' + x);
      const sign = Math.sign(x - prev);
      if (sign && sign !== lastSign) { turns++; lastSign = sign; }
      prev = x;
    }
    assert(turns >= 4, 'bounces ' + turns);
    S.drop(0); S.next();
  }
});
t('odd grabs start left moving right, even grabs start right moving left', () => {
  const S = new L.Taptap2Session(4);
  for (let g = 0; g < 7; g++) {
    const gr = S.grab();
    assert.strictEqual(gr.dir, g % 2 === 0 ? 1 : -1);
    assert(gr.dir > 0 ? S.clawX(100) > 150 : S.clawX(100) < 930);
    S.drop(0); S.next();
  }
});
t('speed rises 420 -> 820 over 7 grabs', () => {
  const S = new L.Taptap2Session(5), sp = [];
  while (!S.done()) { sp.push(S.grab().speed); S.drop(0); S.next(); }
  assert.strictEqual(sp.length, 7); assert.strictEqual(sp[0], 420); assert.strictEqual(sp[6], 820);
  for (let i = 1; i < 7; i++) assert(sp[i] > sp[i - 1]);
  assert.strictEqual(Math.round(new L.Taptap2Session(5).clawX(1000)), 570); // 420 px/s from 150
});
function msOver(S, x) { const g = S.grab(); return (g.dir > 0 ? x - G.railMin : G.railMax - x) / g.speed * 1000; }
function slotOf(S, balm) { return S.grab().layout.indexOf(balm); }
t('drop at exact centre = 200, d=56 -> 100, d=57 -> empty, wrong balm = 0', () => {
  let S = new L.Taptap2Session(11), g = S.grab(), sx = G.slotX[slotOf(S, g.target)];
  let r = S.drop(msOver(S, sx));
  assert.strictEqual(r.result, 'got'); assert.strictEqual(r.points, 200); assert.strictEqual(r.balm, g.target); assert.strictEqual(S.score, 200);
  S = new L.Taptap2Session(11); g = S.grab(); sx = G.slotX[slotOf(S, g.target)];
  const side = sx + 56 <= 930 ? 1 : -1;
  r = S.drop(msOver(S, sx + side * 12)); assert.strictEqual(r.points, 200);
  S = new L.Taptap2Session(11); r = S.drop(msOver(S, sx + side * 56)); assert.strictEqual(r.result, 'got'); assert.strictEqual(r.points, 100); assert.strictEqual(r.d, 56);
  S = new L.Taptap2Session(11); r = S.drop(msOver(S, sx + side * 34)); assert.strictEqual(r.points, 150);
  S = new L.Taptap2Session(11); r = S.drop(msOver(S, sx + side * 57)); assert.strictEqual(r.result, 'empty'); assert.strictEqual(r.points, 0); assert.strictEqual(r.balm, null);
  S = new L.Taptap2Session(11); g = S.grab();
  const ws = g.layout.findIndex(b => b !== g.target);
  r = S.drop(msOver(S, G.slotX[ws])); assert.strictEqual(r.result, 'wrong'); assert.strictEqual(r.points, 0); assert.strictEqual(r.slot, ws); assert.strictEqual(r.balm, g.layout[ws]);
  assert.strictEqual(S.score, 0); assert.strictEqual(S.results[0], 'wrong');
  assert.strictEqual(S.drop(0), null); // one drop per grab
});
t('latency shifts the judged x', () => {
  const A = new L.Taptap2Session(12), B = new L.Taptap2Session(12, { latencyMs: 120 });
  assert.strictEqual(B.clawX(1000), A.clawX(1000));
  const sx = G.slotX[slotOf(A, A.grab().target)], ms = msOver(A, sx);
  assert.strictEqual(A.drop(ms).points, 200);
  const rb = B.drop(ms + 120); assert.strictEqual(rb.points, 200); assert(Math.abs(rb.x - sx) < 1e-6);
  const C = new L.Taptap2Session(12, { latencyMs: 120 }); assert.notStrictEqual(C.drop(ms).x, rb.x);
});
t('each balm is the target once; every layout holds all 7; target changes slot every grab', () => {
  for (let s = 1; s <= 500; s++) {
    const S = new L.Taptap2Session(s), targets = [];
    let prevSlot = -1;
    while (!S.done()) {
      const g = S.grab();
      assert.strictEqual(g.i, targets.length);
      assert.deepStrictEqual(g.layout.slice().sort(), [0, 1, 2, 3, 4, 5, 6]);
      const slot = g.layout.indexOf(g.target);
      assert.notStrictEqual(slot, prevSlot, 'seed ' + s);
      prevSlot = slot; targets.push(g.target);
      S.drop(0); S.next();
    }
    assert.deepStrictEqual(targets.slice().sort(), [0, 1, 2, 3, 4, 5, 6]);
  }
});
t('deterministic per seed, max = 1400', () => {
  const run = s => { const S = new L.Taptap2Session(s), o = []; while (!S.done()) { o.push(S.grab()); S.drop(1234); S.next(); } return JSON.stringify([o, S.results, S.score]); };
  assert.strictEqual(run(77), run(77)); assert.notStrictEqual(run(77), run(78));
  const S = new L.Taptap2Session(1); assert.strictEqual(S.max, 1400); assert.strictEqual(S.seed, 1);
  while (!S.done()) { S.drop(msOver(S, G.slotX[slotOf(S, S.grab().target)])); S.next(); }
  assert.strictEqual(S.score, 1400); assert.deepStrictEqual(S.results, Array(7).fill('got'));
});
t('fuzz 500 seeds: random drops never throw, 0 <= score <= max', () => {
  for (let s = 1; s <= 500; s++) {
    const R = L.rng(s * 104729), S = new L.Taptap2Session(s, { latencyMs: Math.floor(R() * 200) });
    let steps = 0;
    while (!S.done() && steps++ < 100) {
      const r = S.drop(R() * 20000 - 500);
      if (r) assert(['got', 'wrong', 'empty'].indexOf(r.result) >= 0 && r.points >= 0 && r.points <= 200);
      if (R() < 0.2) S.drop(R() * 9000);
      S.next();
      assert(S.score >= 0 && S.score <= S.max, 'seed ' + s);
    }
    assert(S.done()); assert.strictEqual(S.grab(), null); assert.strictEqual(S.drop(100), null);
  }
});

console.log('UM-PAH! 1 (MEMO)');
const M = L.MEMO;
// slot indices of each shade's pair, in deck order of first appearance
function pairsOf(S) { const m = {}; S.deck.forEach((k, i) => (m[k] = m[k] || []).push(i)); return Object.keys(m).map(k => m[k]); }
// a slot holding a different shade than slot i (and not matched)
function otherThan(S, i) { return S.deck.findIndex((k, j) => k !== S.deck[i] && !S.matched[j]); }
t('constants as TASK A2 (v2.6.1: 6 pairs, 3 x 4, 140 / 60) + difficulty levels', () => {
  assert.strictEqual(M.pairs, 6); assert.strictEqual(M.cols, 3); assert.strictEqual(M.rows, 4);
  assert.strictEqual(M.peekMs, 3000); assert.strictEqual(M.activeMs, 45000);
  assert.deepStrictEqual(M.points, { pair: 140, combo: 60, perSecondLeft: 10 });
  assert.strictEqual(M.max, 1500);
  assert.deepStrictEqual(M.levels, { easy: { peekMs: 5000, activeMs: 60000 }, normal: { peekMs: 3000, activeMs: 45000 }, hard: { peekMs: 2000, activeMs: 35000 } });
});
t('new session: deck = 6 distinct shades x 2 in 12 slots, clean state', () => {
  for (let s = 1; s <= 200; s++) {
    const S = new L.Umpah1Session(s);
    assert.strictEqual(S.deck.length, 12);
    const p = pairsOf(S);
    assert.strictEqual(p.length, 6, 'seed ' + s);
    p.forEach(x => assert.strictEqual(x.length, 2));
    S.deck.forEach(k => assert(S10.indexOf(k) >= 0, k));
    assert.deepStrictEqual(S.matched, Array(12).fill(false));
    assert.deepStrictEqual(S.found, []); assert.deepStrictEqual(S.open, []);
    assert.strictEqual(S.misses, 0); assert.strictEqual(S.score, 0); assert.strictEqual(S.streak, 0); assert.strictEqual(S.pairsFound, 0);
    assert.strictEqual(S.max, 1500); assert.strictEqual(S.seed, s); assert.strictEqual(S.difficulty, 'normal');
    assert.strictEqual(S.peekMs, 3000); assert.strictEqual(S.activeMs, 45000);
    assert.strictEqual(S.done(), false);
  }
});
t('deterministic per seed, differs between seeds; 200 seeds cover all 10 shades, pairs land everywhere', () => {
  assert.deepStrictEqual(new L.Umpah1Session(42).deck, new L.Umpah1Session(42).deck);
  assert.notDeepStrictEqual(new L.Umpah1Session(42).deck, new L.Umpah1Session(43).deck);
  const seen = new Set(), slot0 = new Set(), adjacent = { yes: 0, no: 0 };
  for (let s = 1; s <= 200; s++) {
    const S = new L.Umpah1Session(s);
    S.deck.forEach(k => seen.add(k)); slot0.add(S.deck[0]);
    S.deck[0] === S.deck[1] ? adjacent.yes++ : adjacent.no++;
  }
  assert.strictEqual(seen.size, 10);
  assert.strictEqual(slot0.size, 10);
  assert(adjacent.no > adjacent.yes, 'deck looks unshuffled');
});
t('ignored: bad index, open card, 2 cards open, matched card, game over', () => {
  const S = new L.Umpah1Session(5), p = pairsOf(S);
  [-1, 12, 16, 1.5, undefined, null, '3'].forEach(i => assert.strictEqual(S.flip(i).result, 'ignored', String(i)));
  const a = p[0][0], x = otherThan(S, a);
  assert.strictEqual(S.flip(a).result, 'first');
  const ig = S.flip(a);                                  // same card again
  assert.deepStrictEqual(ig, { result: 'ignored', a: a, b: null, shade: S.deck[a], points: 0, streak: 0, pairsFound: 0, done: false });
  assert.strictEqual(S.flip(x).result, 'nomatch');
  assert.strictEqual(S.flip(p[2][0]).result, 'ignored'); // two cards already open
  assert.deepStrictEqual(S.open, [a, x]);
  S.hideOpen();
  S.flip(p[0][0]); assert.strictEqual(S.flip(p[0][1]).result, 'match');
  assert.strictEqual(S.flip(p[0][0]).result, 'ignored'); // matched
  assert.strictEqual(S.flip(p[0][1]).result, 'ignored');
  assert.strictEqual(S.misses, 1); assert.strictEqual(S.score, 140);
  S.timeUp();
  assert.strictEqual(S.flip(p[1][0]).result, 'ignored'); // game over
});
t('first / match / nomatch results; nomatch stays open until hideOpen()', () => {
  const S = new L.Umpah1Session(8), p = pairsOf(S), a = p[2][0], b = p[2][1], x = otherThan(S, a);
  assert.deepStrictEqual(S.flip(a), { result: 'first', a: a, b: null, shade: S.deck[a], points: 0, streak: 0, pairsFound: 0, done: false });
  assert.deepStrictEqual(S.open, [a]);
  assert.deepStrictEqual(S.flip(x), { result: 'nomatch', a: a, b: x, shade: S.deck[x], points: 0, streak: 0, pairsFound: 0, done: false });
  assert.deepStrictEqual(S.open, [a, x]); assert.strictEqual(S.misses, 1);
  assert.deepStrictEqual(S.hideOpen(), [a, x]); assert.deepStrictEqual(S.open, []);
  assert.deepStrictEqual(S.hideOpen(), []);
  S.flip(b);
  assert.deepStrictEqual(S.flip(a), { result: 'match', a: b, b: a, shade: S.deck[a], points: 140, streak: 1, pairsFound: 1, done: false });
  assert(S.matched[a] && S.matched[b]); assert.strictEqual(S.matched.filter(Boolean).length, 2);
  assert.deepStrictEqual(S.open, []); assert.deepStrictEqual(S.found, [S.deck[a]]);
  assert.deepStrictEqual(S.hideOpen(), []);                 // matched cards never hide
});
// v2.6.1 (6 pairs, 140 / combo 60): "alternating" = 6 matches x 140 = 840 with no combo. On a full clear the last 2 matches are
// always back to back (one pair left, no nomatch possible), so the reachable alternating clear is 5 x 140 + 200 = 900.
t('combo maths: perfect run 1140, match after nomatch = 140 (alternating 840 base / 900 full clear), streak resets only on nomatch', () => {
  let S = new L.Umpah1Session(11), pts = [], last;
  pairsOf(S).forEach(q => { S.flip(q[0]); last = S.flip(q[1]); pts.push(last.points); });
  assert.deepStrictEqual(pts, [140, 200, 200, 200, 200, 200]);
  assert.strictEqual(S.score, 1140); assert.strictEqual(last.streak, 6); assert.strictEqual(last.pairsFound, 6); assert.strictEqual(last.done, true);
  assert.strictEqual(S.done(), true); assert.strictEqual(S.misses, 0);
  assert.deepStrictEqual(S.found, pairsOf(new L.Umpah1Session(11)).map(q => S.deck[q[0]]));
  S = new L.Umpah1Session(11); pts = [];
  pairsOf(S).forEach((q, n) => {
    if (n < 5) {                                           // nomatch first, while >= 2 pairs are left
      const a = S.matched.indexOf(false), r = S.flip(a), r2 = S.flip(otherThan(S, a));
      assert.strictEqual(r.result, 'first'); assert.strictEqual(r2.result, 'nomatch'); assert.strictEqual(S.streak, 0); S.hideOpen();
    }
    S.flip(q[0]); const r = S.flip(q[1]); assert.strictEqual(r.result, 'match'); pts.push(r.points);
  });
  assert.deepStrictEqual(pts, [140, 140, 140, 140, 140, 200]);
  assert.strictEqual(pts.slice(0, 5).reduce((x, y) => x + y) + 140, 840);
  assert.strictEqual(S.score, 900); assert.strictEqual(S.misses, 5); assert(S.done());
  S = new L.Umpah1Session(12); const p = pairsOf(S);       // 'first' and 'ignored' flips between matches keep the streak
  S.flip(p[0][0]); S.flip(p[0][1]); S.flip(p[0][0]); S.flip(p[1][0]); S.flip(p[1][0]);
  assert.strictEqual(S.flip(p[1][1]).points, 200);
});
t('complete(msLeft): bonus 10 per whole second, once, only when all pairs found', () => {
  let S = new L.Umpah1Session(13), p = pairsOf(S);
  p.slice(0, 5).forEach(q => { S.flip(q[0]); S.flip(q[1]); });
  assert.strictEqual(S.complete(15000), 0); assert.strictEqual(S.score, 940);    // not complete yet
  S.flip(p[5][0]); S.flip(p[5][1]); assert.strictEqual(S.score, 1140);
  assert.strictEqual(S.complete(15999), 150); assert.strictEqual(S.score, 1290); assert.strictEqual(S.bonus, 150);
  assert.strictEqual(S.complete(15000), 0); assert.strictEqual(S.score, 1290);   // once
  S = new L.Umpah1Session(13); p.forEach(q => { S.flip(q[0]); S.flip(q[1]); });
  assert.strictEqual(S.complete(-500), 0); assert.strictEqual(S.score, 1140);    // negative ms = no bonus
  S = new L.Umpah1Session(13); p.forEach(q => { S.flip(q[0]); S.flip(q[1]); });
  assert.strictEqual(S.complete(0), 0); assert.strictEqual(S.complete(30000), 0); assert.strictEqual(S.score, 1140);  // a 0 bonus is paid too
  S = new L.Umpah1Session(13); p.forEach(q => { S.flip(q[0]); S.flip(q[1]); });
  S.timeUp(); assert.strictEqual(S.complete(10000), 0); assert.strictEqual(S.score, 1140);                            // no bonus after timeUp
});
t('score capped at max 1500 (easy: perfect + 60 s left)', () => {
  const S = new L.Umpah1Session(14, { difficulty: 'easy' });
  pairsOf(S).forEach(q => { S.flip(q[0]); S.flip(q[1]); });
  assert.strictEqual(S.complete(60000), 360); assert.strictEqual(S.score, 1500); assert.strictEqual(S.bonus, 360);
});
t('timeUp(): ends the game, returns + closes open cards, no bonus afterwards', () => {
  const S = new L.Umpah1Session(15), p = pairsOf(S);
  S.flip(p[0][0]); S.flip(p[0][1]); S.flip(p[1][0]);
  assert.deepStrictEqual(S.timeUp(), [p[1][0]]);
  assert(S.done()); assert.deepStrictEqual(S.open, []);
  assert.strictEqual(S.flip(p[1][1]).result, 'ignored');
  assert.strictEqual(S.complete(20000), 0); assert.strictEqual(S.score, 140);
  assert.deepStrictEqual(S.timeUp(), []);
  assert.deepStrictEqual(S.found, [S.deck[p[0][0]]]);
});
t('difficulty: no opts == normal (same deck, byte for byte); easy/hard only change peek/active time', () => {
  for (let s = 1; s <= 200; s++) {
    const N = JSON.stringify(new L.Umpah1Session(s));
    assert.strictEqual(JSON.stringify(new L.Umpah1Session(s, {})), N);
    assert.strictEqual(JSON.stringify(new L.Umpah1Session(s, { difficulty: 'normal' })), N);
    assert.deepStrictEqual(new L.Umpah1Session(s, { difficulty: 'hard' }).deck, new L.Umpah1Session(s).deck);
  }
  const E = new L.Umpah1Session(3, { difficulty: 'easy' }), H = new L.Umpah1Session(3, { difficulty: 'hard' }), X = new L.Umpah1Session(3, { difficulty: 'nightmare' });
  assert.deepStrictEqual([E.difficulty, E.peekMs, E.activeMs], ['easy', 5000, 60000]);
  assert.deepStrictEqual([H.difficulty, H.peekMs, H.activeMs], ['hard', 2000, 35000]);
  assert.deepStrictEqual([X.difficulty, X.peekMs, X.activeMs], ['normal', 3000, 45000]);   // unknown -> normal
  assert.strictEqual(H.max, 1500);
  pairsOf(H).forEach(q => { H.flip(q[0]); H.flip(q[1]); }); assert.strictEqual(H.score, 1140);
});
t('fuzz 500 seeds: random flips/hideOpen/timeUp/complete never throw, invariants hold', () => {
  for (let s = 1; s <= 500; s++) {
    const R = L.rng(s * 6151), S = new L.Umpah1Session(s, { difficulty: ['easy', 'normal', 'hard'][s % 3] });
    let steps = 0;
    while (!S.done() && steps++ < 400) {
      const x = R();
      if (x < 0.005) S.timeUp();
      else if (x < 0.25) S.hideOpen();
      else {
        const r = S.flip(Math.floor(R() * 17) - (R() < 0.05 ? 1 : 0));
        assert(['ignored', 'first', 'match', 'nomatch'].indexOf(r.result) >= 0);
        assert(r.points >= 0 && r.points <= 200);
      }
      assert(S.score >= 0 && S.score <= S.max, 'seed ' + s);
      assert(S.open.length <= 2);
      assert.strictEqual(S.matched.filter(Boolean).length, 2 * S.found.length);
      assert.strictEqual(new Set(S.found).size, S.found.length);
    }
    if (!S.done()) S.timeUp();
    S.complete(R() * 60000);
    assert(S.done() && S.score <= 1500, 'seed ' + s);
    assert.strictEqual(S.pairsFound, S.found.length);
  }
});

console.log('DIFFICULTY (v2.3 D: Dễ / Vừa / Khó)');
const T1 = require('../../js/logic.js');
const LV = ['easy', 'normal', 'hard'];
const digest = x => require('crypto').createHash('sha1').update(JSON.stringify(x)).digest('hex');
// one scripted game per seed: everything observable (deck/chart/layout/order/targets, every result, final score)
const PLAY = {
  umpah: (s, o) => {
    const S = new L.Umpah1Session(s, o), out = [S.deck.slice(), S.max];
    pairsOf(S).forEach((q, n) => {
      if (n % 3 === 1) { out.push(S.flip(q[0]), S.flip(otherThan(S, q[0]))); S.hideOpen(); }
      out.push(S.flip(q[0]), S.flip(q[1]));
    });
    out.push(S.complete(12345), S.score, S.misses, S.found);
    return out;
  },
  umpah2: (s, o) => {
    const S = new L.Umpah2Session(s, o), out = [S.order.slice(), S.max];
    while (!S.done()) {
      const lip = S.lip(), w = lip.choices.filter(x => x !== lip.target), k = lip.i % 4;
      out.push(lip);
      if (k === 1 || k === 2) out.push(S.pick(w[0], 900));
      out.push(S.pick(k === 2 ? w[1] : lip.target, [400, 2000, 700, 3500][k]));
      S.next();
    }
    out.push(S.score, S.results);
    return out;
  },
  taptap: (s, o) => {
    const S = new T1.TilesSession(s, o), out = [JSON.parse(JSON.stringify(S.notes)), S.max], evs = [];
    S.notes.forEach((n, j) => {
      if (j % 9 === 8) return;
      const tt = n.t + [-130, -60, 0, 25, 80, 150, 200][j % 7];
      evs.push([tt, n.lane]);
      if (n.gold && j % 2 === 0) evs.push([tt + 200, n.lane]);
    });
    for (let tt = 7; tt < 30000; tt += 2000) evs.push([tt, 0]);
    evs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    evs.forEach(e => {
      out.push(S.update(e[0]).map(n => n.id));
      const ev = S.tap(e[1], e[0]); out.push(ev && [ev.type, ev.points, ev.note ? ev.note.id : null]);
    });
    out.push(S.update(31000).map(n => n.id), S.score, S.combo, S.maxCombo, S.stats);
    return out;
  },
  taptap2: (s, o) => {
    const S = new L.Taptap2Session(s, o), out = [S.max];
    while (!S.done()) {
      const g = S.grab(); out.push(g);
      out.push(S.drop(g.i % 3 === 0 ? msOver(S, G.slotX[slotOf(S, g.target)]) + g.i * 9 : 300 + g.i * 777)); S.next();
    }
    out.push(S.score, S.results);
    return out;
  }
};
// sha1 of the 50-seed scripted games WITHOUT opts, computed on v2.3-C-fix (= today, before item D); umpah re-based in v2.6.1 (6 pairs, 140 / 60)
const GOLD = { umpah: '0863b0fb41a3a564b852bde6494576f2ac6cef80', umpah2: 'e703bedfe27e3d09e423c271fd88a84a6d7fb322', taptap: 'b3515847629f2c2e906315b2d4f2b3a93c9beb72', taptap2: 'b1f4f5d6f076c70a7227a0557d5467557feae628' };
t('normal == no opts == today (v2.3-C-fix) byte for byte, 50 seeds x scripted game, all 4 games; unknown -> normal', () => {
  const got = {};
  Object.keys(PLAY).forEach(g => {
    const all = [];
    for (let s = 1; s <= 50; s++) {
      const a = PLAY[g](s);
      [{}, { difficulty: 'normal' }, { difficulty: 'nightmare' }, { difficulty: 'hasOwnProperty' }]
        .forEach(o => assert.deepStrictEqual(PLAY[g](s, o), a, g + ' seed ' + s + ' ' + JSON.stringify(o)));
      all.push(a);
    }
    got[g] = digest(all);
  });
  assert.deepStrictEqual(got, GOLD, 'differs from today');
  [new L.Umpah1Session(1), new L.Umpah2Session(1), new T1.TilesSession(1), new L.Taptap2Session(1), new L.Taptap2Session(1, { difficulty: 'x' })]
    .forEach(S => assert.strictEqual(S.difficulty, 'normal'));
});
t('values as TASK §D table (session fields); module constants unchanged', () => {
  [['easy', 5000, 60000], ['normal', 3000, 45000], ['hard', 2000, 35000]].forEach(([d, p, a]) => {
    const S = new L.Umpah1Session(1, { difficulty: d }); assert.deepStrictEqual([S.difficulty, S.peekMs, S.activeMs, S.max], [d, p, a, 1500]);
  });
  const FF = 'FF', NF = 'NF', NN = 'NN';
  const plans = { easy: [FF, FF, FF, FF, FF, NF, NF, NF, NF, NF], normal: [FF, FF, FF, NF, NF, NF, NF, NN, NN, NN], hard: [FF, FF, NF, NF, NF, NN, NN, NN, NN, NN] };
  [['easy', 40000], ['normal', 30000], ['hard', 24000]].forEach(([d, ms]) => {
    const S = new L.Umpah2Session(1, { difficulty: d }); assert.deepStrictEqual([S.difficulty, S.activeMs, S.plan, S.max], [d, ms, plans[d], 1500]);
  });
  assert.strictEqual(K.activeMs, 30000); assert.deepStrictEqual(K.plan, plans.normal);
  [['easy', 87.5, 175], ['normal', 70, 140], ['hard', 59.5, 119]].forEach(([d, p, g]) => {
    const S = new T1.TilesSession(1, { difficulty: d }); assert.deepStrictEqual([S.difficulty, S.perfectMs, S.goodMs], [d, p, g]);
  });
  assert.strictEqual(T1.TILES.perfectMs, 70); assert.strictEqual(T1.TILES.goodMs, 140);
  assert.deepStrictEqual(T1.TILES.phases.map(p => [p.interval, p.approach]), [[600, 1500], [460, 1150], [380, 900]]);
  [['easy', 340, 640, 62], ['normal', 420, 820, 56], ['hard', 520, 980, 48]].forEach(([d, a, b, h]) => {
    const S = new L.Taptap2Session(1, { difficulty: d }), sp = [];
    assert.deepStrictEqual([S.difficulty, S.speedStart, S.speedEnd, S.hitHalf, S.max], [d, a, b, h, 1400]);
    while (!S.done()) { sp.push(S.grab().speed); S.drop(0); S.next(); }
    assert.strictEqual(sp[0], a); assert.strictEqual(sp[6], b);
    for (let i = 1; i < 7; i++) assert(sp[i] > sp[i - 1]);
  });
  assert.deepStrictEqual([G.speedStart, G.speedEnd, G.hitHalf, G.perfectPx], [420, 820, 56, 12]);
  const B = new L.Taptap2Session(1, { difficulty: 'hard', latencyMs: 120 }); assert.deepStrictEqual([B.latencyMs, B.hitHalf], [120, 48]);
});
// band checks of every lip against the session's own plan
function checkLips(S, tag) {
  assert.deepStrictEqual(S.order.slice().sort(), S10.slice(), tag);
  S._lips.forEach((lip, i) => {
    const c = lip.choices, d = c.filter(x => x !== lip.target), N = L.near(lip.target), F = L.far(lip.target), plan = S.plan[i];
    assert.strictEqual(lip.target, S.order[i]); assert.strictEqual(new Set(c).size, 3); assert.strictEqual(d.length, 2, tag);
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) assert(dE(c[a], c[b]) >= 5.5, `${tag} lip ${i} ${c[a]}/${c[b]}`);
    if (plan === 'FF') assert(F.indexOf(d[0]) >= 0 && F.indexOf(d[1]) >= 0, tag);
    if (plan === 'NN') {
      assert(N.indexOf(d[0]) >= 0 && N.indexOf(d[1]) >= 0, tag);
      assert(lip.target !== '10_leather' && L.decoyPairs(lip.target, 'NN').length >= 1, tag + ' lip ' + i + ' ' + lip.target);
    }
    if (plan === 'NF') assert((N.indexOf(d[0]) >= 0 && F.indexOf(d[1]) >= 0) || (N.indexOf(d[1]) >= 0 && F.indexOf(d[0]) >= 0), tag);
  });
}
t('Um-Pah! 2 hard (5 NN lips): 1000 seeds, every NN target has a valid NN pair (never 10_leather); easy 300 seeds bands', () => {
  assert(S10.filter(s => L.decoyPairs(s, 'NN').length >= 2).length >= 5);   // enough shades for 5 NN lips
  const nnShades = new Set();
  for (let s = 1; s <= 1000; s++) {
    const H = new L.Umpah2Session(s, { difficulty: 'hard' });
    checkLips(H, 'hard seed ' + s);
    H.plan.forEach((p, i) => { if (p === 'NN') nnShades.add(H.order[i]); });
  }
  assert.strictEqual(nnShades.size, 9);                                      // all shades but 10_leather do appear on NN lips
  for (let s = 1; s <= 300; s++) checkLips(new L.Umpah2Session(s, { difficulty: 'easy' }), 'easy seed ' + s);
});
const phaseOf = tt => T1.TILES.phases.findIndex(p => tt < p.until);
t('Tap-Tap! 1 charts: interval/approach x1.2 easy, x0.88 hard (whole ms); S.max from its own chart; easy fewer notes, hard more', () => {
  const want = { easy: [[720, 1800], [552, 1380], [456, 1080]], normal: [[600, 1500], [460, 1150], [380, 900]], hard: [[528, 1320], [405, 1012], [334, 792]] };
  for (let s = 1; s <= 50; s++) {
    const n = {};
    LV.forEach(d => {
      const S = new T1.TilesSession(s, { difficulty: d }), c = S.notes;
      n[d] = c.length;
      assert.strictEqual(S.max, T1.chartMax(c));
      assert.strictEqual(c[0].t, 1600); assert(c.every(x => x.t <= 29000 && x.lane >= 0 && x.lane < 4));
      c.forEach((x, i) => {
        assert.strictEqual(x.approach, want[d][phaseOf(x.t)][1], d + ' seed ' + s);
        if (i && x.t !== c[i - 1].t) assert.strictEqual(x.t - c[i - 1].t, want[d][phaseOf(c[i - 1].t)][0], d + ' seed ' + s);
        if (i && x.t === c[i - 1].t) assert.notStrictEqual(x.lane, c[i - 1].lane);
      });
    });
    assert(n.easy < n.normal && n.normal < n.hard, 'seed ' + s + ' ' + JSON.stringify(n));
  }
});
t('Tap-Tap! 1 hit windows x1.25 easy / x0.85 hard judge taps and misses; perfect play = max on every level', () => {
  const at = (d, dt) => { const S = new T1.TilesSession(9, { difficulty: d }), n = S.notes[0]; S.update(n.t + dt); return S.tap(n.lane, n.t + dt).type; };
  assert.deepStrictEqual(LV.map(d => at(d, 80)), ['perfect', 'good', 'good']);
  assert.deepStrictEqual(LV.map(d => at(d, 65)), ['perfect', 'perfect', 'good']);
  assert.deepStrictEqual(LV.map(d => at(d, -125)), ['good', 'good', 'empty']);
  assert.deepStrictEqual(LV.map(d => at(d, 160)), ['good', 'empty', 'empty']);
  const missed = (d, dt) => { const S = new T1.TilesSession(9, { difficulty: d }); return S.update(S.notes[0].t + dt).length > 0; };
  assert.deepStrictEqual(LV.map(d => missed(d, 150)), [false, true, true]);
  assert.deepStrictEqual(LV.map(d => missed(d, 130)), [false, false, true]);
  LV.forEach(d => {
    for (let s = 1; s <= 50; s++) {
      const S = new T1.TilesSession(s, { difficulty: d }), evs = [];
      S.notes.forEach(n => { evs.push([n.t, n.lane]); if (n.gold) evs.push([n.t + 150, n.lane]); });
      evs.sort((a, b) => a[0] - b[0]);
      evs.forEach(e => { S.update(e[0]); S.tap(e[1], e[0]); });
      S.update(31000);
      assert.strictEqual(S.score, S.max, d + ' seed ' + s); assert.strictEqual(S.stats.miss + S.stats.empty, 0);
    }
  });
});
t('Tap-Tap! 2 points use the session hitHalf (perfectPx 12 unchanged)', () => {
  [['easy', 62, 156], ['normal', 56, 150], ['hard', 48, 150]].forEach(([d, h, p34]) => {
    const mk = () => new L.Taptap2Session(11, { difficulty: d });
    let S = mk();
    const sx = G.slotX[slotOf(S, S.grab().target)], side = sx + 63 <= 930 ? 1 : -1;
    const drop = dx => { S = mk(); return S.drop(msOver(S, sx + side * dx)); };
    assert.strictEqual(drop(0).points, 200); assert.strictEqual(drop(12).points, 200);
    let r = drop(h); assert.deepStrictEqual([r.result, r.points], ['got', 100], d);
    r = drop(h + (d === 'easy' ? 0.5 : 1)); assert.deepStrictEqual([r.result, r.points, r.balm], ['empty', 0, null], d);
    if (d !== 'hard') assert.strictEqual(drop(34).points, p34, d);
    else assert.strictEqual(drop(30).points, 150);
  });
});
t('fuzz 300 seeds x 3 levels x 4 games: never throws, 0 <= score <= max', () => {
  const ok = (S, tag) => assert(S.score >= 0 && S.score <= S.max, tag + ' score ' + S.score + '/' + S.max);
  LV.forEach((d, di) => {
    for (let s = 1; s <= 300; s++) {
      const R = L.rng(s * 7907 + di), o = { difficulty: d }, tag = d + ' seed ' + s;
      let S = new L.Umpah1Session(s, o), k = 0;
      while (!S.done() && k++ < 300) { if (R() < 0.3) S.hideOpen(); else S.flip(Math.floor(R() * 17) - 1); if (R() < 0.003) S.timeUp(); ok(S, 'umpah ' + tag); }
      S.complete(R() * S.activeMs); ok(S, 'umpah ' + tag);
      S = new L.Umpah2Session(s, o); k = 0;
      while (!S.done() && k++ < 200) {
        const x = R();
        if (x < 0.02) S.timeUp(); else if (x < 0.1) S.pick(S10[Math.floor(R() * 10)], R() * 6000); else S.pick(S.lip().choices[Math.floor(R() * 3)], R() * 6000);
        if (S.lip() && S.results[S.lip().i]) S.next();
        ok(S, 'umpah2 ' + tag);
      }
      assert(S.done(), 'umpah2 ' + tag);
      S = new T1.TilesSession(s, o);
      const evs = [];
      S.notes.forEach(n => {
        if (R() < 0.15) return;
        const tt = n.t + (R() - 0.5) * 2.6 * S.goodMs; evs.push([tt, R() < 0.9 ? n.lane : Math.floor(R() * 6) - 1]);
        if (n.gold && R() < 0.7) evs.push([tt + 100 + R() * 400, n.lane]);
      });
      for (let i = 0; i < 30; i++) evs.push([R() * 30000, Math.floor(R() * 4)]);
      evs.sort((a, b) => a[0] - b[0]);
      evs.forEach(e => { S.update(e[0]); S.tap(e[1], e[0]); ok(S, 'taptap ' + tag); });
      S.update(31000); ok(S, 'taptap ' + tag);
      S = new L.Taptap2Session(s, { difficulty: d, latencyMs: Math.floor(R() * 200) }); k = 0;
      while (!S.done() && k++ < 100) {
        const r = S.drop(R() * 20000 - 500);
        if (r) assert(r.points >= 0 && r.points <= 200);
        S.next(); ok(S, 'taptap2 ' + tag);
      }
      assert(S.done(), 'taptap2 ' + tag);
    }
  });
});

console.log(`\n${passed} tests passed` + (process.exitCode ? ' — SOME FAILED' : ''));
