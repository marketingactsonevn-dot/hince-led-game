/* hince LED Game v2.2 — pure logic for Um-Pah! 2 (match the tube to the lips) and Tap-Tap! 2 (claw machine).
   No DOM. Browser: window.Logic2 · Node: module.exports (tests/app_tests/logic2.test.js). */
(function (root) {
  'use strict';

  // same RNG as logic.js (copied so logic.js stays untouched)
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shuffle(a, r) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  // v2.3 difficulty: opts.difficulty 'easy' | 'normal' | 'hard'; none/unknown = 'normal' (= the v2.2 values)
  function level(levels, opts) { var d = opts && opts.difficulty; return levels.hasOwnProperty(d) ? d : 'normal'; }

  // =====================================================================
  // UM-PAH! 2 — a lip photo is shown, drag the matching Nu Blur tube onto it
  // =====================================================================
  var KISS = {
    lips: 10, activeMs: 30000,              // timer runs only while tubes are touchable (paused during animations)
    points: { first: 100, second: 40 },     // first try / second try; missed = 0
    speedBonus: [[1500, 50], [3000, 25]],   // first-try only: ms from "touchable" to drop
    farCount: 3, nearMin: 5.5, nearMax: 10, // deltaE bands
    plan: ['FF', 'FF', 'FF', 'NF', 'NF', 'NF', 'NF', 'NN', 'NN', 'NN']
  };
  KISS.levels = {
    easy: { activeMs: 40000, plan: ['FF', 'FF', 'FF', 'FF', 'FF', 'NF', 'NF', 'NF', 'NF', 'NF'] },
    normal: { activeMs: KISS.activeMs, plan: KISS.plan },
    hard: { activeMs: 24000, plan: ['FF', 'FF', 'NF', 'NF', 'NF', 'NN', 'NN', 'NN', 'NN', 'NN'] }
  };
  var SHADES = ['01_near', '02_dear', '03_nu_allure', '04_figray', '05_hug', '06_nu_rose', '07_heart', '08_wild', '09_cold', '10_leather'];
  // CIE76 deltaE between the lip photos, from assets/_pipeline/lips_photo_colors.json (rows/cols in SHADES order)
  var DE = [
    [0.0, 6.5, 11.3, 6.7, 7.8, 9.5, 10.8, 14.1, 14.9, 12.9],
    [6.5, 0.0, 9.4, 6.4, 9.9, 10.2, 8.6, 10.5, 13.0, 16.9],
    [11.3, 9.4, 0.0, 5.4, 10.5, 8.9, 11.1, 5.7, 4.7, 13.4],
    [6.7, 6.4, 5.4, 0.0, 5.7, 5.1, 7.6, 7.7, 9.9, 11.1],
    [7.8, 9.9, 10.5, 5.7, 0.0, 2.7, 6.7, 11.0, 14.9, 8.9],
    [9.5, 10.2, 8.9, 5.1, 2.7, 0.0, 6.1, 8.7, 13.3, 9.2],
    [10.8, 8.6, 11.1, 7.6, 6.7, 6.1, 0.0, 8.6, 15.7, 15.2],
    [14.1, 10.5, 5.7, 7.7, 11.0, 8.7, 8.6, 0.0, 9.0, 15.9],
    [14.9, 13.0, 4.7, 9.9, 14.9, 13.3, 15.7, 9.0, 0.0, 16.0],
    [12.9, 16.9, 13.4, 11.1, 8.9, 9.2, 15.2, 15.9, 16.0, 0.0]
  ];
  function deltaE(a, b) { return DE[SHADES.indexOf(a)][SHADES.indexOf(b)]; }
  function others(t) { return SHADES.filter(function (s) { return s !== t; }); }
  function near(t) { return others(t).filter(function (s) { var d = deltaE(t, s); return d >= KISS.nearMin && d < KISS.nearMax; }); }
  // 3 largest deltaE; ties (09_cold: Near = Hug = 14.9) go to the lower shade number
  function far(t) {
    return others(t).sort(function (a, b) { return deltaE(t, b) - deltaE(t, a) || SHADES.indexOf(a) - SHADES.indexOf(b); }).slice(0, KISS.farCount);
  }
  // all valid decoy pairs for target t and plan 'FF' | 'NF' | 'NN': distinct, every pair of the 3 choices >= nearMin
  function decoyPairs(t, plan) {
    var A = plan.charAt(0) === 'N' ? near(t) : far(t), B = plan.charAt(1) === 'N' ? near(t) : far(t), out = [], seen = {};
    for (var i = 0; i < A.length; i++) for (var j = 0; j < B.length; j++) {
      var a = A[i], b = B[j], k = a < b ? a + b : b + a;
      if (a === b || seen[k] || deltaE(a, b) < KISS.nearMin) continue;
      seen[k] = 1; out.push([a, b]);
    }
    return out;
  }
  function kissBonus(ms) {
    for (var i = 0; i < KISS.speedBonus.length; i++) if (ms <= KISS.speedBonus[i][0]) return KISS.speedBonus[i][1];
    return 0;
  }

  // opts.difficulty changes activeMs (S.activeMs, the UI timer) and the decoy plan (S.plan); scoring and max never change
  function Umpah2Session(seed, opts) {
    var r = rng(seed), n = KISS.lips, i, j, x, d = level(KISS.levels, opts), plan = KISS.levels[d].plan;
    this.seed = seed;
    this.difficulty = d;
    this.activeMs = KISS.levels[d].activeMs;
    this.plan = plan.slice();
    this.order = shuffle(SHADES.slice(), r);
    // 10_leather has no valid NN pair: a shade on an NN lip without one swaps with an earlier non-NN lip that has one
    // (every plan puts its NN lips last, after >= 5 non-NN lips, so such a lip always exists)
    for (i = 0; i < n; i++) {
      if (plan[i] !== 'NN' || decoyPairs(this.order[i], 'NN').length) continue;
      var ok = [];
      for (j = 0; j < i; j++) if (plan[j] !== 'NN' && decoyPairs(this.order[j], 'NN').length) ok.push(j);
      j = ok[Math.floor(r() * ok.length)];
      x = this.order[i]; this.order[i] = this.order[j]; this.order[j] = x;
    }
    this._lips = [];
    for (i = 0; i < n; i++) {
      var t = this.order[i], pairs = decoyPairs(t, plan[i]), p = pairs[Math.floor(r() * pairs.length)];
      this._lips.push({ i: i, target: t, choices: shuffle([t, p[0], p[1]], r) });
    }
    this.i = 0;
    this.wrong = null;          // key of the first wrong pick on the current lip
    this.score = 0;
    this.max = n * (KISS.points.first + KISS.speedBonus[0][1]);
    this.results = [];
    for (i = 0; i < n; i++) this.results.push(null);
  }
  Umpah2Session.prototype.done = function () { return this.i >= KISS.lips; };
  Umpah2Session.prototype.lip = function () { return this.done() ? null : this._lips[this.i]; };
  // key = shade key picked, ms = time since the tubes became touchable. null if the lip is already resolved / game over.
  Umpah2Session.prototype.pick = function (key, ms) {
    if (this.done() || this.results[this.i]) return null;
    var target = this._lips[this.i].target, res, pts = 0;
    if (key === target) {
      res = this.wrong ? 'second' : 'first';
      pts = this.wrong ? KISS.points.second : KISS.points.first + kissBonus(ms);
    } else if (this.wrong) res = 'missed';
    else { this.wrong = key; return { result: 'wrong', points: 0, lipDone: false, target: target }; }
    this.results[this.i] = res;
    this.score += pts;
    return { result: res, points: pts, lipDone: true, target: target };
  };
  // advances only once the current lip is resolved
  Umpah2Session.prototype.next = function () {
    if (!this.done() && this.results[this.i]) { this.i++; this.wrong = null; }
  };
  Umpah2Session.prototype.timeUp = function () {
    for (var i = this.i; i < KISS.lips; i++) if (!this.results[i]) this.results[i] = 'missed';
    this.i = KISS.lips;
  };

  // =====================================================================
  // TAP-TAP! 2 — claw machine, 7 grabs = the 7 Radiance Balms (balm = index into ASSETS.RB)
  // =====================================================================
  var GRAB = {
    grabs: 7,                                    // one per shade
    slotX: [165, 290, 415, 540, 665, 790, 915],  // balm centres (canvas px)
    railMin: 150, railMax: 930,                  // claw centre range
    speedStart: 420, speedEnd: 820,              // px/s, lerp over grab 1 -> 7
    hitHalf: 56, perfectPx: 12,                  // claw centre within +-56 px of a balm centre grabs it
    points: { base: 100, centre: 100 },          // max per grab 200 -> max 1400
    idleMs: 8000                                 // no tap for 8 s -> the claw drops by itself
  };
  GRAB.levels = {
    easy: { speedStart: 340, speedEnd: 640, hitHalf: 62 },
    normal: { speedStart: GRAB.speedStart, speedEnd: GRAB.speedEnd, hitHalf: GRAB.hitHalf },
    hard: { speedStart: 520, speedEnd: 980, hitHalf: 48 }
  };

  // opts.latencyMs (Admin), opts.difficulty: claw speeds (S.speedStart/S.speedEnd) and S.hitHalf; perfectPx and max never change
  function Taptap2Session(seed, opts) {
    var r = rng(seed), n = GRAB.grabs, prev = -1, i, d = level(GRAB.levels, opts), lv = GRAB.levels[d];
    this.seed = seed;
    this.latencyMs = (opts && opts.latencyMs) || 0;
    this.difficulty = d;
    this.speedStart = lv.speedStart;
    this.speedEnd = lv.speedEnd;
    this.hitHalf = lv.hitHalf;
    var targets = shuffle(range(n), r);
    this._grabs = [];
    for (i = 0; i < n; i++) {
      var t = targets[i], layout = shuffle(range(n), r), s = layout.indexOf(t);
      if (s === prev) { var o = (s + 1 + Math.floor(r() * (n - 1))) % n; layout[s] = layout[o]; layout[o] = t; s = o; }
      prev = s;
      this._grabs.push({ i: i, target: t, layout: layout, speed: this.speedStart + (this.speedEnd - this.speedStart) * i / (n - 1), dir: i % 2 ? -1 : 1 });
    }
    this.i = 0;
    this.score = 0;
    this.max = n * (GRAB.points.base + GRAB.points.centre);
    this.results = [];
    for (i = 0; i < n; i++) this.results.push(null);
  }
  Taptap2Session.prototype.done = function () { return this.i >= GRAB.grabs; };
  Taptap2Session.prototype.grab = function () { return this.done() ? null : this._grabs[this.i]; };
  // claw centre x at ms since the claw started moving this grab (triangle wave from its start side)
  Taptap2Session.prototype.clawX = function (ms) {
    var g = this._grabs[Math.min(this.i, GRAB.grabs - 1)], span = GRAB.railMax - GRAB.railMin;
    var p = (g.speed * (ms > 0 ? ms : 0) / 1000) % (2 * span);
    if (p > span) p = 2 * span - p;
    return g.dir > 0 ? GRAB.railMin + p : GRAB.railMax - p;
  };
  // tap at ms (same clock as clawX); judged at clawX(ms - latencyMs). null if already dropped / game over.
  Taptap2Session.prototype.drop = function (ms) {
    if (this.done() || this.results[this.i]) return null;
    var g = this._grabs[this.i], x = this.clawX(ms - this.latencyMs), slot = 0, j;
    for (j = 1; j < GRAB.slotX.length; j++) if (Math.abs(x - GRAB.slotX[j]) < Math.abs(x - GRAB.slotX[slot])) slot = j;
    var d = Math.round(Math.abs(x - GRAB.slotX[slot]) * 100) / 100, res = 'empty', pts = 0, balm = null;
    if (d > this.hitHalf) slot = null;
    else {
      balm = g.layout[slot];
      if (balm !== g.target) res = 'wrong';
      else {
        res = 'got';
        pts = GRAB.points.base + Math.round(GRAB.points.centre * clamp(1 - Math.max(0, d - GRAB.perfectPx) / (this.hitHalf - GRAB.perfectPx), 0, 1));
      }
    }
    this.results[this.i] = res;
    this.score += pts;
    return { result: res, slot: slot, balm: balm, d: d, points: pts, x: x };
  };
  Taptap2Session.prototype.next = function () { if (!this.done() && this.results[this.i]) this.i++; };

  // =====================================================================
  // UM-PAH! 1 (v2.3, v2.6.1: 6 pairs) — "Lật Cặp Môi": lip-photo memory game, 6 pairs on a 3 cols x 4 rows grid (slot = row * 3 + col)
  // =====================================================================
  var MEMO = {
    pairs: 6, cols: 3, rows: 4,
    peekMs: 3000, activeMs: 45000,                       // "Vừa" (normal)
    points: { pair: 140, combo: 60, perSecondLeft: 10 }, // combo = 2nd+ match with no nomatch since the previous match; v2.6.1: 6 pairs, a perfect run = 140 + 5 x 200 = 1140 (8 pairs gave 1150)
    max: 1500,                                           // score capped at max; gift tiers = % of max
    levels: { easy: { peekMs: 5000, activeMs: 60000 }, normal: { peekMs: 3000, activeMs: 45000 }, hard: { peekMs: 2000, activeMs: 35000 } }
  };

  // opts.difficulty 'easy' | 'normal' | 'hard' (unknown/none = normal) changes only peekMs/activeMs, never the deck or scoring
  function Umpah1Session(seed, opts) {
    var r = rng(seed), d = level(MEMO.levels, opts), lv = MEMO.levels[d], i;
    this.seed = seed;
    this.difficulty = d;
    this.peekMs = lv.peekMs;
    this.activeMs = lv.activeMs;
    var pick = shuffle(SHADES.slice(), r).slice(0, MEMO.pairs);
    this.deck = shuffle(pick.concat(pick), r);
    this.matched = [];
    for (i = 0; i < this.deck.length; i++) this.matched.push(false);
    this.open = [];             // face-up unmatched slots (0..2)
    this.found = [];            // shades in the order found
    this.misses = 0;
    this.streak = 0;            // matches in a row (reset by nomatch)
    this.pairsFound = 0;
    this.score = 0;
    this.bonus = 0;             // time bonus added by complete()
    this.max = MEMO.max;
    this._over = false;
    this._paid = false;         // complete() already ran (even when it added 0)
  }
  Umpah1Session.prototype.done = function () { return this._over || this.pairsFound >= MEMO.pairs; };
  Umpah1Session.prototype._res = function (result, a, b, shade, points) {
    return { result: result, a: a, b: b, shade: shade, points: points, streak: this.streak, pairsFound: this.pairsFound, done: this.done() };
  };
  Umpah1Session.prototype.flip = function (i) {
    var ok = typeof i === 'number' && i % 1 === 0 && i >= 0 && i < this.deck.length;
    if (!ok || this.done() || this.matched[i] || this.open.length >= 2 || this.open.indexOf(i) >= 0)
      return this._res('ignored', ok ? i : null, null, ok ? this.deck[i] : null, 0);
    if (!this.open.length) { this.open.push(i); return this._res('first', i, null, this.deck[i], 0); }
    var a = this.open[0], shade = this.deck[i];
    if (this.deck[a] !== shade) {
      this.open.push(i); this.misses++; this.streak = 0;
      return this._res('nomatch', a, i, shade, 0);
    }
    this.matched[a] = this.matched[i] = true;
    this.open = [];
    this.found.push(shade);
    this.pairsFound++;
    this.streak++;
    var pts = MEMO.points.pair + (this.streak >= 2 ? MEMO.points.combo : 0);
    this.score = Math.min(this.max, this.score + pts);
    return this._res('match', a, i, shade, pts);
  };
  // turns the open unmatched cards face-down again; returns their slots
  Umpah1Session.prototype.hideOpen = function () { var o = this.open; this.open = []; return o; };
  // time bonus once all pairs are found (once, never after timeUp); returns the points actually added (after the max cap)
  Umpah1Session.prototype.complete = function (msLeft) {
    if (this.pairsFound < MEMO.pairs || this._over || this._paid) return 0;
    this._paid = true;
    var add = Math.min(this.max - this.score, MEMO.points.perSecondLeft * Math.floor(Math.max(0, msLeft || 0) / 1000));
    this.score += add; this.bonus = add;
    return add;
  };
  // ends the game; returns the open unmatched slots (they flip back)
  Umpah1Session.prototype.timeUp = function () { this._over = true; return this.hideOpen(); };

  var api = {
    rng: rng, SHADES: SHADES, deltaE: deltaE, near: near, far: far, decoyPairs: decoyPairs,
    KISS: KISS, Umpah2Session: Umpah2Session,
    GRAB: GRAB, Taptap2Session: Taptap2Session,
    MEMO: MEMO, Umpah1Session: Umpah1Session
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic2 = api;
})(this);
