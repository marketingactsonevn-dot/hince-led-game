/* hince LED Game — pure game logic (no DOM). Runs in browser (window.Logic) and Node (module.exports) for tests. */
(function (root) {
  'use strict';

  // ---------- RNG ----------
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
  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function normDeg(d) { d = d % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; }

  // =====================================================================
  // UM-PAH PRESS
  // Hold = "Um": a marker runs around a ring starting at the top (0deg).
  // Release = "Pah!": judged by marker angle vs. the blur zone.
  // =====================================================================
  var UMPAH = {
    rounds: 10,
    periodStart: 2400, periodEnd: 1300,     // ms per full loop
    zoneStart: 70, zoneEnd: 26,             // zone width in degrees
    perfectFrac: 0.35,                      // inner part of half-zone = perfect
    reverseFromRound: 5,                    // 0-based
    driftFromRound: 7, driftAmp: 30, driftPeriodMs: 3000,  // zone sways +-30deg (never reaches start)
    minStartGap: 100, maxStartGap: 290,     // zone centre distance from start along direction
    maxLoops: 2,                            // hold longer than this = miss
    roundIdleMs: 8000,
    points: { perfect: 150, good: 80, miss: 0 },
    streakBonus: 20, streakBonusCap: 100
  };

  function umpahRound(i, r) {
    var k = UMPAH.rounds > 1 ? i / (UMPAH.rounds - 1) : 0;
    var dir = (i >= UMPAH.reverseFromRound && r() < 0.5) ? -1 : 1;
    var gap = lerp(UMPAH.minStartGap, UMPAH.maxStartGap, r());
    var drift = 0;
    if (i >= UMPAH.driftFromRound) drift = (r() < 0.5 ? -1 : 1) * UMPAH.driftAmp;
    return {
      index: i,
      periodMs: Math.round(lerp(UMPAH.periodStart, UMPAH.periodEnd, k)),
      zoneDeg: Math.round(lerp(UMPAH.zoneStart, UMPAH.zoneEnd, k)),
      dir: dir,
      zoneCenter0: normDeg(dir * gap),       // degrees, 0 = top, clockwise positive
      driftAmp: drift
    };
  }

  // angle travelled (deg, signed) after holding ms
  function umpahMarker(round, holdMs) { return round.dir * 360 * holdMs / round.periodMs; }
  // zone centre at time since round start (drift keeps moving while round is shown)
  function umpahZoneCenter(round, sinceRoundStartMs) {
    if (!round.driftAmp) return round.zoneCenter0;
    return normDeg(round.zoneCenter0 + round.driftAmp * Math.sin(2 * Math.PI * sinceRoundStartMs / UMPAH.driftPeriodMs));
  }

  function umpahJudge(round, holdMs, sinceRoundStartAtRelease) {
    if (holdMs < 0) holdMs = 0;
    if (holdMs > UMPAH.maxLoops * round.periodMs) return { result: 'miss', reason: 'long', delta: 999 };
    var marker = umpahMarker(round, holdMs);
    var center = umpahZoneCenter(round, sinceRoundStartAtRelease);
    var delta = Math.abs(normDeg(marker - center));
    var half = round.zoneDeg / 2;
    var result = delta <= half * UMPAH.perfectFrac ? 'perfect' : (delta <= half ? 'good' : 'miss');
    return { result: result, delta: delta, reason: result === 'miss' ? 'off' : '' };
  }

  function umpahPoints(result, streak) {
    var base = UMPAH.points[result] || 0;
    if (result !== 'perfect') return base;
    return base + Math.min(UMPAH.streakBonusCap, UMPAH.streakBonus * Math.max(0, streak - 1));
  }

  function umpahMax() {
    var s = 0;
    for (var i = 1; i <= UMPAH.rounds; i++) s += umpahPoints('perfect', i);
    return s;
  }

  // Stateful session helper (used by UI and tests)
  function UmpahSession(seed) {
    this.r = rng(seed);
    this.seed = seed;
    this.round = 0;
    this.score = 0;
    this.streak = 0;
    this.results = [];
    this.current = umpahRound(0, this.r);
    this.max = umpahMax();
  }
  UmpahSession.prototype.release = function (holdMs, sinceRoundStart) {
    var j = umpahJudge(this.current, holdMs, sinceRoundStart);
    if (j.result === 'perfect') this.streak++; else this.streak = 0;
    var pts = umpahPoints(j.result, this.streak);
    this.score += pts;
    j.points = pts; j.streak = this.streak;
    this.results.push(j.result);
    this.next();
    return j;
  };
  UmpahSession.prototype.timeout = function () {
    this.streak = 0; this.results.push('miss'); this.next();
    return { result: 'miss', reason: 'idle', points: 0 };
  };
  UmpahSession.prototype.next = function () {
    this.round++;
    if (this.round < UMPAH.rounds) this.current = umpahRound(this.round, this.r);
  };
  UmpahSession.prototype.done = function () { return this.round >= UMPAH.rounds; };

  // =====================================================================
  // GLOW TILES (Tap-Tap!)
  // =====================================================================
  var TILES = {
    lanes: 4,
    durationMs: 30000,
    firstNoteMs: 1600,
    lastNoteMs: 29000,
    phases: [ // until (ms), interval, approach (ms from top to hit line), pairChance, goldChance
      { until: 10000, interval: 600, approach: 1500, pair: 0, gold: 0.10 },
      { until: 20000, interval: 460, approach: 1150, pair: 0.06, gold: 0.13 },
      { until: 30001, interval: 380, approach: 900, pair: 0.12, gold: 0.13 }
    ],
    goldFromMs: 3000,
    perfectMs: 70, goodMs: 140,
    goldSecondMs: 450,
    ghostMs: 40,
    points: { perfect: 100, good: 60, gold: 100, empty: -20 },
    combo: [{ from: 0, mult: 1 }, { from: 10, mult: 1.5 }, { from: 25, mult: 2 }]
  };

  // v2.3 difficulty (additive; TILES itself never changes): factors for the chart (note interval, approach) and the hit
  // windows (perfectMs, goodMs). Session opts.difficulty 'easy' | 'normal' | 'hard'; none/unknown = normal = TILES as is.
  var TILES_LEVELS = {
    easy: { interval: 1.2, approach: 1.2, windows: 1.25 },
    normal: { interval: 1, approach: 1, windows: 1 },
    hard: { interval: 0.88, approach: 0.88, windows: 0.85 }
  };

  function tilesPhase(t) {
    for (var i = 0; i < TILES.phases.length; i++) if (t < TILES.phases[i].until) return TILES.phases[i];
    return TILES.phases[TILES.phases.length - 1];
  }

  // f (optional) = a TILES_LEVELS entry: interval/approach scaled and rounded to whole ms (factor 1 = unchanged)
  function buildChart(seed, f) {
    var r = rng(seed), notes = [], t = TILES.firstNoteMs, lastLane = -1, sameCount = 0, id = 0;
    var fi = f ? f.interval : 1, fa = f ? f.approach : 1;
    while (t <= TILES.lastNoteMs) {
      var ph = tilesPhase(t), approach = Math.round(ph.approach * fa);
      var lane = Math.floor(r() * TILES.lanes);
      if (lane === lastLane) { sameCount++; if (sameCount >= 2) { lane = (lane + 1 + Math.floor(r() * 3)) % TILES.lanes; sameCount = 0; } }
      else sameCount = 0;
      lastLane = lane;
      var isPair = r() < ph.pair;
      var isGold = !isPair && t >= TILES.goldFromMs && r() < ph.gold;
      notes.push({ id: id++, t: t, lane: lane, gold: isGold, approach: approach });
      if (isPair) {
        var lane2 = (lane + 1 + Math.floor(r() * 3)) % TILES.lanes;
        notes.push({ id: id++, t: t, lane: lane2, gold: false, approach: approach });
      }
      t += Math.round(ph.interval * fi);
    }
    return notes;
  }

  function comboMult(combo) {
    var m = 1;
    for (var i = 0; i < TILES.combo.length; i++) if (combo >= TILES.combo[i].from) m = TILES.combo[i].mult;
    return m;
  }

  function chartMax(notes) {
    var s = 0, combo = 0;
    var sorted = notes.slice().sort(function (a, b) { return a.t - b.t || a.id - b.id; });
    for (var i = 0; i < sorted.length; i++) {
      combo++;
      var m = comboMult(combo);
      s += Math.round(TILES.points.perfect * m);
      if (sorted[i].gold) s += Math.round(TILES.points.gold * m);
    }
    return s;
  }

  function TilesSession(seed, opts) {
    var d = opts && opts.difficulty;
    if (!TILES_LEVELS.hasOwnProperty(d)) d = 'normal';
    this.seed = seed;
    this.difficulty = d;
    this.perfectMs = TILES.perfectMs * TILES_LEVELS[d].windows; // judging uses these per-session windows
    this.goodMs = TILES.goodMs * TILES_LEVELS[d].windows;
    this.notes = buildChart(seed, TILES_LEVELS[d]);
    this.max = chartMax(this.notes);
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.stats = { perfect: 0, good: 0, miss: 0, gold: 0, empty: 0 };
    this.lastTap = [-1e9, -1e9, -1e9, -1e9];
    this.pendingGold = [null, null, null, null]; // note awaiting second tap per lane
    this.cursor = 0; // first possibly-unjudged index (notes sorted by t)
  }
  TilesSession.prototype._add = function (base) {
    var pts = Math.round(base * comboMult(this.combo));
    this.score = Math.max(0, this.score + pts);
    return pts;
  };
  // returns event {type, points, note}
  TilesSession.prototype.tap = function (lane, t) {
    if (lane < 0 || lane >= TILES.lanes) return null;
    if (t - this.lastTap[lane] < TILES.ghostMs) return null; // ghost / duplicate touch
    this.lastTap[lane] = t;

    // second tap of a gold tile
    var pg = this.pendingGold[lane];
    if (pg && t - pg.hitAt <= TILES.goldSecondMs) {
      this.pendingGold[lane] = null;
      pg.goldDone = true;
      this.stats.gold++;
      return { type: 'gold', points: this._add(TILES.points.gold), note: pg };
    }

    // find nearest unjudged note in lane within good window
    var best = null, bestD = 1e9;
    for (var i = this.cursor; i < this.notes.length; i++) {
      var n = this.notes[i];
      if (n.t - t > this.goodMs) break;
      if (n.judged || n.lane !== lane) continue;
      var d = Math.abs(n.t - t);
      if (d <= this.goodMs && d < bestD) { best = n; bestD = d; }
    }
    if (!best) {
      this.combo = 0; this.stats.empty++;
      return { type: 'empty', points: this._add(TILES.points.empty) };
    }
    best.judged = true; best.hitAt = t;
    var kind = bestD <= this.perfectMs ? 'perfect' : 'good';
    best.result = kind;
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.stats[kind]++;
    if (best.gold) this.pendingGold[lane] = best;
    return { type: kind, points: this._add(TILES.points[kind]), note: best };
  };
  // advance time: mark missed notes; returns array of missed notes
  TilesSession.prototype.update = function (t) {
    var missed = [];
    for (var i = this.cursor; i < this.notes.length; i++) {
      var n = this.notes[i];
      if (n.t + this.goodMs >= t) break;
      if (!n.judged) { n.judged = true; n.result = 'miss'; this.stats.miss++; this.combo = 0; missed.push(n); }
    }
    while (this.cursor < this.notes.length && this.notes[this.cursor].judged && this.notes[this.cursor].t + this.goodMs < t) this.cursor++;
    for (var l = 0; l < TILES.lanes; l++) {
      var p = this.pendingGold[l];
      if (p && t - p.hitAt > TILES.goldSecondMs) this.pendingGold[l] = null;
    }
    return missed;
  };
  TilesSession.prototype.done = function (t) { return t >= TILES.durationMs; };

  // =====================================================================
  // REWARD / DATA
  // =====================================================================
  function pct(score, max) { return max > 0 ? Math.round(1000 * score / max) / 10 : 0; }

  // thresholds: {tier1: pct, tier2: pct}
  function tierFor(scorePct, th) {
    if (scorePct >= th.tier2) return 2;
    if (scorePct >= th.tier1) return 1;
    return 0;
  }

  // Applies duplicate rule + stock. Returns {tier, reason}
  // reason: '' | 'duplicate' | 'outOfStock' | 'downgraded'
  function resolveReward(tier, opts) {
    // opts: {phone, records, rule:'perEvent'|'perDay'|'none', today, stock:{tier1,tier2}}
    if (tier === 0) return { tier: 0, reason: '' };
    if (opts.rule !== 'none') {
      var dup = (opts.records || []).some(function (r) {
        return !r.testMode && r.phone === opts.phone && r.tier > 0 && (opts.rule === 'perEvent' || r.date === opts.today);
      });
      if (dup) return { tier: 0, reason: 'duplicate' };
    }
    var st = opts.stock || { tier1: 0, tier2: 0 };
    if (tier === 2 && st.tier2 > 0) return { tier: 2, reason: '' };
    if (tier === 2 && st.tier1 > 0) return { tier: 1, reason: 'downgraded' };
    if (tier === 1 && st.tier1 > 0) return { tier: 1, reason: '' };
    return { tier: 0, reason: 'outOfStock' };
  }

  function validPhone(p) { return /^0(3|5|7|8|9)\d{8}$/.test(p); }
  function formatPhone(p) {
    return p.length <= 3 ? p : p.length <= 6 ? p.slice(0, 3) + ' ' + p.slice(3) : p.slice(0, 3) + ' ' + p.slice(3, 6) + ' ' + p.slice(6);
  }
  function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
  function validName(n) { n = cleanName(n); return n.length >= 2 && n.length <= 40 && /^[A-Z ]+$/.test(n); }

  var CSV_COLS = ['createdAt', 'date', 'game', 'score', 'maxScore', 'scorePct', 'tier', 'giftName', 'rewardCode', 'reason',
    'name', 'phone', 'consentGift', 'consentMarketing', 'redeemed', 'redeemedAt', 'testMode', 'seed', 'appVersion', 'id',
    'difficulty', 'kiosk', 'lang']; // v2.3/v2.4: appended at the end (older CSVs keep their column order)
  function csvCell(v) {
    if (v === undefined || v === null) v = '';
    v = String(v);
    if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function toCSV(records) {
    var lines = [CSV_COLS.join(',')];
    records.forEach(function (r) {
      lines.push(CSV_COLS.map(function (c) {
        if (c === 'phone' && r.phone) return '="' + r.phone + '"'; // keep leading 0 in Excel
        return csvCell(r[c]);
      }).join(','));
    });
    return '﻿' + lines.join('\r\n');
  }

  function localDate(d) {
    d = d || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  var api = {
    rng: rng, clamp: clamp, normDeg: normDeg,
    UMPAH: UMPAH, umpahRound: umpahRound, umpahMarker: umpahMarker, umpahZoneCenter: umpahZoneCenter,
    umpahJudge: umpahJudge, umpahPoints: umpahPoints, umpahMax: umpahMax, UmpahSession: UmpahSession,
    TILES: TILES, TILES_LEVELS: TILES_LEVELS, buildChart: buildChart, chartMax: chartMax, comboMult: comboMult, TilesSession: TilesSession,
    pct: pct, tierFor: tierFor, resolveReward: resolveReward,
    validPhone: validPhone, formatPhone: formatPhone, cleanName: cleanName, validName: validName,
    toCSV: toCSV, CSV_COLS: CSV_COLS, localDate: localDate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
