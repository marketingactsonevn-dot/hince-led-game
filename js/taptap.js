/* Tap-Tap! — v2.6 paper (07_taptap1): canvas rhythm game, 4 lanes on the toffee paper. Constants, timing and hit logic unchanged since v2;
   only the drawing changed. Every sprite (background + lanes, pads, balms with their shadow, gold balm, press glow / ring, stamp words)
   is pre-rendered once; a frame only blits them. Pad, press ring and glow are all centred on the same (cx(l), HIT). */
(function () {
  'use strict';
  var T = Logic.TILES;
  // canvas px: lane l = x LX + l*LP … +LW from TOP down; hit line HIT (judging is by time; y only places the drawing)
  var W = 1080, H = 1920, LX = 60, LP = 245, LW = 225, TOP = 370, HIT = 1640;
  var LANE_BOTTOM = 1790, BALM_H = 280, PAD = [122, 116], RING = 85, GLOW = 160; // geometry.json taptap1: pad file 244x232, cap centre (122,116)
  var SH = { blur: 14, y: 20, col: 'rgba(40,22,12,.32)' }, M = 40; // balm shadow 0 20 14 (pre-rendered), sprite margin
  var canvas, ctx, SRC, bg = null, padImg = null, tiles = [], goldImg = null, glowImg = null, ringImg = null, spark = null, built = -1, fontOk = false, shade = [];
  var TXT = {}; // pre-rendered stamp words
  var S = null, raf = 0, t0 = 0, running = false, onEnd = null, latency = 0;
  var fx = [], laneFlash = [-1e9, -1e9, -1e9, -1e9];
  var comboEl, timeEl, scoreEl, segEls, lastSec, lastLit, lastScore, lastCombo; // HUD: DOM written only on change
  var FONT = 'italic 600 70px "Noto Serif Display Variable"';

  function cx(l) { return LX + l * LP + LW / 2; } // lane centre: 172.5, 417.5, 662.5, 907.5
  function padAt(l) { return [cx(l) - PAD[0], HIT - PAD[1]]; } // drawImage(pad, cx − 122, HIT − 116): cap centre == (cx, HIT)
  function ringAt(l) { return [cx(l), HIT]; }
  function img(p) { var i = ASSETS.cache[p]; return i && i.complete && i.naturalWidth ? i : null; }

  function init() {
    canvas = document.getElementById('tt-canvas'); ctx = canvas.getContext('2d');
    comboEl = document.getElementById('tt-combo'); timeEl = document.getElementById('tt-time');
    scoreEl = document.getElementById('tt-score'); segEls = document.getElementById('tt-seg').children;
    SRC = ASSETS.RB.map(ASSETS.rb).concat(ASSETS.v26('bg/bg_toffee_paper.jpg'), ASSETS.v26('tap/cap_pad.png'), ASSETS.v26('stickers/p_sparkle.svg'), ASSETS.v26('stickers/p_star.svg'));
    canvas.addEventListener('pointerdown', onDown);
  }

  // sprites are (re)built whenever more of their sources (images + the serif font) are ready than last time
  function readyCount() {
    var n = fontOk ? 1 : 0;
    for (var i = 0; i < SRC.length; i++) if (img(SRC[i])) n++;
    return n;
  }
  function canvasOf(w, h) { var c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function buildSprites() {
    fontOk = !document.fonts || document.fonts.check(FONT);
    if (!fontOk) document.fonts.load(FONT).then(function () { fontOk = true; }, function () { });
    built = readyCount();
    bg = buildBg();
    padImg = img(ASSETS.v26('tap/cap_pad.png'));
    tiles = ASSETS.RB.map(function (n) { return makeBalm(img(ASSETS.rb(n))); });
    goldImg = makeGold(img(ASSETS.rb('gleaming')));
    glowImg = makeGlow(); ringImg = makeRing();
    var sp = img(ASSETS.v26('stickers/p_sparkle.svg')); spark = sp ? sticker(sp, 76) : null;
    TXT = { perfect: makeStamp('Perfect!', 70), good: makeStamp('Good', 64), gold: makeStamp('Tap-Tap!', 64), miss: makeStamp('Miss', 58), tap: makeStamp('TAP!', 58) };
  }
  // background: toffee paper + 4 rounded lanes (r 30, cream .13 fill, 2 px inner cream .45 line) + dashed cream hit line at HIT − 96
  function buildBg() {
    var c = canvasOf(W, H), b = c.getContext('2d'), paper = img(ASSETS.v26('bg/bg_toffee_paper.jpg'));
    b.fillStyle = '#B6845D'; b.fillRect(0, 0, W, H);
    if (paper) b.drawImage(paper, 0, 0, W, H);
    for (var l = 0; l < 4; l++) {
      var x = LX + l * LP;
      b.fillStyle = 'rgba(251,244,236,.13)'; rr(b, x, TOP, LW, LANE_BOTTOM - TOP, 30); b.fill();
      b.strokeStyle = 'rgba(251,244,236,.45)'; b.lineWidth = 2; rr(b, x + 1, TOP + 1, LW - 2, LANE_BOTTOM - TOP - 2, 29); b.stroke();
    }
    b.strokeStyle = 'rgba(251,244,236,.7)'; b.lineWidth = 4; b.setLineDash([12, 10]);
    b.beginPath(); b.moveTo(70, HIT - 96); b.lineTo(W - 70, HIT - 96); b.stroke(); b.setLineDash([]);
    return c;
  }
  function rr(b, x, y, w, h, r) { b.beginPath(); b.moveTo(x + r, y); b.arcTo(x + w, y, x + w, y + h, r); b.arcTo(x + w, y + h, x, y + h, r); b.arcTo(x, y + h, x, y, r); b.arcTo(x, y, x + w, y, r); b.closePath(); }
  // product photo, height 280, with its drop shadow baked in; the image centre sits at (c.cx, c.cy) inside the sprite
  function makeBalm(im) {
    if (!im) return null;
    var w = BALM_H * im.naturalWidth / im.naturalHeight, c = canvasOf(w + 2 * M, BALM_H + 2 * M + SH.y), x = c.getContext('2d');
    x.shadowColor = SH.col; x.shadowBlur = SH.blur; x.shadowOffsetY = SH.y;
    x.drawImage(im, M, M, w, BALM_H);
    c.cx = M + w / 2; c.cy = M + BALM_H / 2;
    return c;
  }
  // gold balm: champagne halo 260 behind + gleaming.png + ×2 badge (70) at the image top-right
  function makeGold(im) {
    var b = makeBalm(im); if (!b) return null;
    var c = canvasOf(b.width + 80, b.height + 80), x = c.getContext('2d'), ox = 40, oy = 40, hx = ox + b.cx, hy = oy + b.cy;
    var g = x.createRadialGradient(hx, hy, 0, hx, hy, 130);
    g.addColorStop(0, 'rgba(255,236,196,.95)'); g.addColorStop(.38, 'rgba(248,216,185,.6)'); g.addColorStop(.7, 'rgba(248,216,185,0)'); g.addColorStop(1, 'rgba(248,216,185,0)');
    x.fillStyle = g; x.fillRect(hx - 130, hy - 130, 260, 260);
    x.drawImage(b, ox, oy);
    var bx = hx + 38, by = hy - BALM_H / 2 + 8; // badge centre: image top-right
    x.save(); x.translate(bx, by); x.rotate(-8 * Math.PI / 180);
    x.shadowColor = 'rgba(40,22,12,.45)'; x.shadowBlur = 16; x.shadowOffsetY = 10;
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 40, 0, Math.PI * 2); x.fill(); x.shadowColor = 'transparent';
    var bg2 = x.createRadialGradient(-12, -10, 2, 0, 0, 35); bg2.addColorStop(0, '#FCE7C8'); bg2.addColorStop(.7, '#EBC08E'); bg2.addColorStop(1, '#D9A877');
    x.fillStyle = bg2; x.beginPath(); x.arc(0, 0, 35, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#4C362B'; x.font = '700 27px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('×2', 0, 1);
    x.restore();
    c.cx = hx; c.cy = hy;
    return c;
  }
  // press glow (320, centre (GLOW, GLOW)) and azalea ring (170, 6 px, soft cream outer glow); both centred on (cx, HIT) when drawn
  function makeGlow() {
    var c = canvasOf(2 * GLOW, 2 * GLOW), x = c.getContext('2d'), g = x.createRadialGradient(GLOW, GLOW, 0, GLOW, GLOW, GLOW);
    g.addColorStop(0, 'rgba(255,250,244,.9)'); g.addColorStop(.34, 'rgba(223,166,187,.75)'); g.addColorStop(.7, 'rgba(223,166,187,0)'); g.addColorStop(1, 'rgba(223,166,187,0)');
    x.fillStyle = g; x.fillRect(0, 0, 2 * GLOW, 2 * GLOW);
    return c;
  }
  function makeRing() {
    var R = RING + 40, c = canvasOf(2 * R, 2 * R), x = c.getContext('2d');
    x.shadowColor = 'rgba(255,250,244,.8)'; x.shadowBlur = 26;
    x.strokeStyle = '#DFA6BB'; x.lineWidth = 6; x.beginPath(); x.arc(R, R, RING + 3, 0, Math.PI * 2); x.stroke(); // box-shadow 0 0 0 6px: 6 px band outside the 170 circle
    return c;
  }
  function sticker(im, w) { var h = w * im.naturalHeight / im.naturalWidth, c = canvasOf(w, h); c.getContext('2d').drawImage(im, 0, 0, w, h); return c; }
  // stamp word: italic serif #9C6A44 on cream .88, 5 px border, radius 14, rotated −8°
  function makeStamp(s, px) {
    var m = canvasOf(10, 10).getContext('2d'); m.font = 'italic 600 ' + px + 'px "Noto Serif Display Variable", serif';
    var tw = Math.ceil(m.measureText(s).width), bw = tw + 44, bh = Math.ceil(px * 1.18) + 16, d = Math.ceil(Math.hypot(bw, bh)) + 8;
    var c = canvasOf(d, d), x = c.getContext('2d');
    x.translate(d / 2, d / 2); x.rotate(-8 * Math.PI / 180);
    x.fillStyle = 'rgba(251,244,236,.88)'; rr(x, -bw / 2, -bh / 2, bw, bh, 14); x.fill();
    x.strokeStyle = '#9C6A44'; x.lineWidth = 5; rr(x, -bw / 2 + 2.5, -bh / 2 + 2.5, bw - 5, bh - 5, 12); x.stroke();
    x.fillStyle = '#9C6A44'; x.font = 'italic 600 ' + px + 'px "Noto Serif Display Variable", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(s, 0, -px * 0.04);
    return c;
  }
  // draw sprite c centred on (x, y) at scale s (keeps edge-lane words inside the screen)
  function put(c, x, y, s) {
    var w = c.width * s, h = c.height * s;
    ctx.drawImage(c, Math.min(W - w / 2, Math.max(w / 2, x)) - w / 2, y - h / 2, w, h);
  }
  // balm sprite with its image centre on (x, y) (exact, never clamped)
  function putBalm(c, x, y, s) {
    if (!c) return;
    if (s === 1 || s == null) { ctx.drawImage(c, Math.round(x - c.cx), Math.round(y - c.cy)); return; }
    ctx.drawImage(c, x - c.cx * s, y - c.cy * s, c.width * s, c.height * s);
  }

  function start(session, opts, cbEnd) {
    S = session; onEnd = cbEnd; latency = opts.latencyMs || 0;
    if (readyCount() !== built) buildSprites();
    var seed = S.seed >>> 0;
    shade = S.notes.map(function (n, i) { return (seed + i * 7919) % tiles.length; }); // balm shade per note, from the seed
    fx = []; laneFlash = [-1e9, -1e9, -1e9, -1e9];
    hud(T.durationMs, 0, 0);
    t0 = performance.now();
    var times = S.notes.map(function (n) { return n.t; });
    var at = Sfx.now() + latency / 1000;
    Sfx.scheduleBeats(times, at); // beats follow the tiles, which are drawn and judged at n.t + latency
    Music.lock(at, times); // BGM groove on the same grid as the beats
    running = true;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); Sfx.stopBeats(); }

  function gameTime(stamp) { return stamp - t0; }

  // TIME n + 15-cell bar (lit = ceil(15 · remaining / 30 s)), SCORE with comma thousands, COMBO ×n from 5
  function hud(remain, score, combo) {
    var sec = Math.ceil(remain / 1000), lit = Math.ceil(segEls.length * remain / T.durationMs);
    if (sec !== lastSec) { timeEl.textContent = Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); lastSec = sec; } // v2.6 0:18
    if (lit !== lastLit) { for (var i = 0; i < segEls.length; i++) segEls[i].classList.toggle('on', i < lit); lastLit = lit; }
    if (score !== lastScore) { scoreEl.textContent = score.toLocaleString('en-US'); lastScore = score; }
    if (combo !== lastCombo) { comboEl.textContent = '\u00D7' + combo; comboEl.classList.toggle('on', combo >= 5); lastCombo = combo; } // v2.6: the combo note always shows ×n
  }

  function onDown(e) {
    if (!running) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * W / rect.width, y = (e.clientY - rect.top) * H / rect.height;
    if (y < TOP) return;
    var lane = Math.min(3, Math.max(0, Math.floor((x - LX + (LP - LW) / 2) / LP))); // gaps split between neighbours
    var now = performance.now();
    var stamp = (typeof e.timeStamp === 'number' && Math.abs(e.timeStamp - now) < 1000) ? e.timeStamp : now;
    var t = gameTime(stamp) - latency;
    var nowT = gameTime(now), mm = S.update(t);
    for (var m = 0; m < mm.length; m++) fx.push({ lane: mm[m].lane, t: nowT, text: 'miss' });
    if (mm.length) Sfx.play('tap_miss');
    var c0 = S.combo, ev = S.tap(lane, t);
    laneFlash[lane] = now;
    if (!ev) return;
    // 1st tap on a gold tile: burst only, the hovering TAP! prompt takes the text slot
    if (ev.type === 'perfect' || ev.type === 'good') { fx.push({ lane: lane, t: nowT, text: ev.note.gold ? '' : ev.type, burst: true }); Sfx.play('tap_lane_' + lane, S.combo >= 10); } // octave up from combo 10
    else if (ev.type === 'gold') { fx.push({ lane: lane, t: nowT, text: 'gold', burst: true }); Sfx.play('tap_gold'); }
    else if (ev.type === 'empty') { fx.push({ lane: lane, t: nowT, text: '', empty: true }); Sfx.play('tap_empty'); }
    if ((c0 < 10 && S.combo >= 10) || (c0 < 25 && S.combo >= 25)) Sfx.play('combo_up');
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (built < SRC.length + 1 && readyCount() !== built) buildSprites(); // an image/font finished late
    var t = gameTime(now);
    var missed = S.update(t - latency);
    for (var m = 0; m < missed.length; m++) fx.push({ lane: missed[m].lane, t: t, text: 'miss' });
    if (missed.length) Sfx.play('tap_miss'); // one sound per batch (pair notes)

    ctx.drawImage(bg, 0, 0);
    // press flash under the pad: glow 320 (220 ms), all on (cx, HIT)
    var l, a, p;
    for (l = 0; l < 4; l++) {
      a = 1 - (now - laneFlash[l]) / 220;
      if (a > 0 && glowImg) { ctx.globalAlpha = a; p = ringAt(l); ctx.drawImage(glowImg, p[0] - GLOW, p[1] - GLOW); ctx.globalAlpha = 1; }
    }
    if (padImg) for (l = 0; l < 4; l++) { p = padAt(l); ctx.drawImage(padImg, p[0], p[1]); }
    for (l = 0; l < 4; l++) { // azalea ring (170) over the pad, same 220 ms
      a = 1 - (now - laneFlash[l]) / 220;
      if (a > 0 && ringImg) { ctx.globalAlpha = a; p = ringAt(l); ctx.drawImage(ringImg, p[0] - ringImg.width / 2, p[1] - ringImg.height / 2); ctx.globalAlpha = 1; }
    }
    // balms (clipped so they emerge from the top of the lanes, never over the HUD)
    ctx.save(); ctx.beginPath(); ctx.rect(0, TOP, W, H - TOP); ctx.clip();
    var span = HIT - TOP, i0 = S.cursor;
    // S.update() moves the cursor past a note in the call that marks it missed: step back so missed tiles keep
    // falling greyed until they leave the screen (≤ 0.315 · approach ≤ 567 ms after n.t at Dễ 1800 ms; 600 ms covers it)
    while (i0 > 0 && S.notes[i0 - 1].t > t - latency - 600) i0--;
    for (var i = i0; i < S.notes.length; i++) {
      var n = S.notes[i];
      var dt = n.t - (t - latency);
      if (dt > n.approach * 1.15) break;
      if (n.judged && n.result !== 'miss') continue;
      var y = HIT - dt / n.approach * span;
      if (y - BALM_H / 2 > H) continue;
      if (n.result === 'miss') ctx.globalAlpha = 0.35;
      putBalm(n.gold ? goldImg : tiles[shade[i]], cx(n.lane), y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // gold balms waiting for the 2nd tap: hover on the pad and pulse
    for (var g = 0; g < 4; g++) {
      if (!S.pendingGold[g]) continue;
      putBalm(goldImg, cx(g), HIT, 1 + 0.06 * Math.sin(now / 45));
      if (TXT.tap) put(TXT.tap, cx(g), HIT - BALM_H / 2 - 50, 1);
    }
    // effects: sparkle sticker + stamp word floating up 60 px
    var keep = [];
    for (var k = 0; k < fx.length; k++) {
      var f = fx[k], age = t - f.t;
      if (age > 600) continue; keep.push(f);
      var fx0 = cx(f.lane), k1 = age / 600, e = 1 - (1 - k1) * (1 - k1); // e: ease-out
      ctx.globalAlpha = 1 - k1;
      if (f.burst && spark) put(spark, fx0 + 70 + 20 * e, HIT - 110 - 20 * e, 0.6 + 0.4 * e);
      if (f.empty) { ctx.strokeStyle = 'rgba(251,244,236,.8)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(fx0, HIT, 40 + 30 * k1, 0, Math.PI * 2); ctx.stroke(); }
      if (f.text && TXT[f.text]) put(TXT[f.text], fx0, HIT - BALM_H / 2 - 90 - 60 * e, 1);
      ctx.globalAlpha = 1;
    }
    fx = keep;

    hud(Math.max(0, T.durationMs - t), S.score, S.combo);

    if (t >= T.durationMs + 400) { var cb = onEnd; stop(); if (cb) cb(S); }
  }

  window.TaptapGame = { init: init, start: start, stop: stop, clock: function () { return performance.now() - t0; } };
  // v2.6 alignment check (tests/app_tests/v26_check.py): the same functions place the pad and the press ring / glow
  window.TapTap = {
    geom: { cx: [0, 1, 2, 3].map(cx), HIT: HIT, TOP: TOP, padHalf: PAD.slice(), ring: RING },
    padCentre: function (l) { var p = padAt(l); return [p[0] + PAD[0], p[1] + PAD[1]]; },
    ringCentre: function (l) { return ringAt(l); }
  };
})();
