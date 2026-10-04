/* Tap-Tap! — v2 lilac pixel lanes (canvas rhythm game, 4 lanes). Layout: design/ux/ux-spec-v2.md §5. */
(function () {
  'use strict';
  var T = Logic.TILES;
  // canvas px: lane l = x LX + l*LP … +LW from TOP down; pads/cards TW×TH centred on the hit line HIT (pads y 1520–1760)
  var W = 1080, H = 1920, LX = 60, LP = 245, LW = 225, TOP = 370, HIT = 1640, TW = 200, TH = 240;
  var TX = 12;  // card/pad x inside the lane: (LW - TW) / 2 = 12.5, floored so pixel edges stay crisp
  var PY = HIT - TH / 2 - 10; // top of the pads strip
  var SP = 20;  // sprite margin around the card (7 px border, 8/14 px hard shadow)
  var canvas, ctx, SRC, bg = null, pads = null, tiles = [], goldImg = null, built = -1, fontOk = false, shade = [];
  var pearl = null, butter = null, TXT = {}; // pre-rendered FX sprites (glowing sparkles, outlined words)
  var S = null, raf = 0, t0 = 0, running = false, onEnd = null, latency = 0;
  var fx = [], laneFlash = [-1e9, -1e9, -1e9, -1e9];
  var comboEl, timeEl, scoreEl, segEls, lastSec, lastLit, lastScore, lastCombo; // HUD: DOM written only on change

  function cardX(l) { return LX + l * LP + TX; }
  function img(p) { var i = ASSETS.cache[p]; return i && i.complete && i.naturalWidth ? i : null; }

  function init() {
    canvas = document.getElementById('tt-canvas'); ctx = canvas.getContext('2d');
    comboEl = document.getElementById('tt-combo'); timeEl = document.getElementById('tt-time');
    scoreEl = document.getElementById('tt-score'); segEls = document.getElementById('tt-seg').children;
    SRC = ASSETS.RB.map(ASSETS.rb).concat(ASSETS.d3('star_chrome'), ASSETS.d3('sparkle_pearl'), ASSETS.d3('sparkle_butter'), ASSETS.bg('tile_lilac_sparkle.png'));
    canvas.addEventListener('pointerdown', onDown);
  }

  // sprites are (re)built whenever more of their sources (11 images + the Silkscreen font) are ready than last time
  function readyCount() {
    var n = fontOk ? 1 : 0;
    for (var i = 0; i < SRC.length; i++) if (img(SRC[i])) n++;
    return n;
  }
  function buildSprites() {
    fontOk = !document.fonts || document.fonts.check('30px Silkscreen');
    if (!fontOk) document.fonts.load('30px Silkscreen').then(function () { fontOk = true; }, function () { });
    built = readyCount();
    bg = buildBg();
    pads = buildPads();
    tiles = ASSETS.RB.map(function (n) { return makeTile(img(ASSETS.rb(n)), false); });
    goldImg = makeTile(img(ASSETS.d3('star_chrome')), true);
    pearl = makeGlow(img(ASSETS.d3('sparkle_pearl')), 300, 26);
    butter = makeGlow(img(ASSETS.d3('sparkle_butter')), 90, 12);
    TXT = {
      perfect: makeText('PERFECT!', 70, '#FF5FA2', '#fff', '#E23F86'),
      good: makeText('GOOD', 60, '#FF5FA2', '#fff', '#E23F86'),
      gold: makeText('TAP-TAP!', 70, '#FFE27A', '#C98A1B', '#C98A1B'),
      miss: makeText('MISS', 56, '#9A8F88', '#fff', null),
      tap: makeText('TAP!', 64, '#C98A1B', '#fff', null)
    };
  }
  // sticker with the .glow white halo baked in (no per-frame shadow/filter)
  function makeGlow(im, w, blur) {
    if (!im) return null;
    var h = w * im.naturalHeight / im.naturalWidth, c = document.createElement('canvas');
    c.width = w + 2 * blur; c.height = h + 2 * blur;
    var x = c.getContext('2d');
    x.shadowColor = 'rgba(255,255,255,.9)'; x.shadowBlur = blur;
    x.drawImage(im, blur, blur, w, h);
    return c;
  }
  // Silkscreen word: optional offset shadow copy (+12/+12), 6 px outline (stroke 12), fill
  function makeText(s, px, fill, line, shadow) {
    var c = document.createElement('canvas'), x = c.getContext('2d'), font = px + 'px Silkscreen';
    x.font = font;
    c.width = Math.ceil(x.measureText(s).width) + 32; c.height = Math.ceil(px * 1.2) + 32; // resizing resets the context
    var cx = c.width / 2 - 4, cy = c.height / 2 - 4;
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; // default miter join = square pixel corners
    if (shadow) { x.fillStyle = shadow; x.fillText(s, cx + 12, cy + 12); } // .ttl.pink: glyph copy 12/12 behind the outline
    x.strokeStyle = line; x.strokeText(s, cx, cy);
    x.fillStyle = fill; x.fillText(s, cx, cy);
    return c;
  }
  function buildBg() {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var b = c.getContext('2d'), tile = img(ASSETS.bg('tile_lilac_sparkle.png'));
    b.imageSmoothingEnabled = false;
    b.fillStyle = '#E4DCFF'; b.fillRect(0, 0, W, H);
    if (tile) {
      var pat = b.createPattern(tile, 'repeat');
      if (tile.naturalWidth !== 256 && pat.setTransform) pat.setTransform(new DOMMatrix().scale(256 / tile.naturalWidth));
      b.fillStyle = pat; b.fillRect(0, 0, W, H);
    }
    for (var l = 0; l < 4; l++) {
      var x = LX + l * LP;
      b.fillStyle = 'rgba(255,255,255,.45)'; b.fillRect(x, TOP, LW, H - TOP);
      b.strokeStyle = '#fff'; b.lineWidth = 6; b.strokeRect(x - 3, TOP - 3, LW + 6, H - TOP + 10); // 6 px frame outside the lane, open at the bottom
    }
    return c;
  }
  // dashed pads on a transparent strip (y PY…PY+260), drawn over the tiles like the mockup
  function buildPads() {
    var c = document.createElement('canvas'); c.width = W; c.height = 260;
    var b = c.getContext('2d');
    b.strokeStyle = '#8C74F0'; b.lineWidth = 6; b.setLineDash([16, 12]);
    for (var l = 0; l < 4; l++) b.strokeRect(cardX(l) + 3, HIT - TH / 2 + 3 - PY, TW - 6, TH - 6);
    return c;
  }
  // pixel card (mockup box-shadows): hard shadow 8/14, 7 px border as 4 side bars (notched corners), card, then the product
  function makeTile(im, gold) {
    var c = document.createElement('canvas'); c.width = TW + 2 * SP; c.height = TH + 2 * SP;
    var x = c.getContext('2d'), col = gold ? ['#FFE27A', '#F5B93B', '#C98A1B'] : ['#fff', '#B9A6FF', '#8C74F0'];
    x.fillStyle = col[2]; x.fillRect(SP + 8, SP + 14, TW, TH);
    x.fillStyle = col[1]; x.fillRect(SP, SP - 7, TW, TH + 14); x.fillRect(SP - 7, SP, TW + 14, TH);
    x.fillStyle = col[0]; x.fillRect(SP, SP, TW, TH);
    if (gold) {
      if (im) {
        x.shadowColor = 'rgba(255,255,255,.9)'; x.shadowBlur = 26; // .glow
        x.drawImage(im, SP + 30, SP + 24, 140, 140 * im.naturalHeight / im.naturalWidth);
        x.shadowColor = 'transparent';
      }
      x.fillStyle = '#5A1238'; x.font = '30px Silkscreen'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('TAP-TAP', SP + TW / 2, SP + 194);
    } else if (im) {
      var h = 210, w = h * im.naturalWidth / im.naturalHeight; // balm h210 at (70,14), rotated −6° about its centre
      x.translate(SP + 70 + w / 2, SP + 14 + h / 2); x.rotate(-6 * Math.PI / 180);
      x.shadowColor = 'rgba(90,20,60,.28)'; x.shadowBlur = 24; x.shadowOffsetY = 20; // .prod
      x.drawImage(im, -w / 2, -h / 2, w, h);
    }
    return c;
  }
  // draw sprite c centred on (x, y) at scale s (keeps edge-lane words inside the screen)
  function put(c, x, y, s) {
    var w = c.width * s, h = c.height * s;
    ctx.drawImage(c, Math.min(W - w / 2, Math.max(w / 2, x)) - w / 2, y - h / 2, w, h);
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
    if (sec !== lastSec) { timeEl.textContent = sec; lastSec = sec; }
    if (lit !== lastLit) { for (var i = 0; i < segEls.length; i++) segEls[i].classList.toggle('on', i < lit); lastLit = lit; }
    if (score !== lastScore) { scoreEl.textContent = score.toLocaleString('en-US'); lastScore = score; }
    if (combo < 5) combo = 0;
    if (combo !== lastCombo) { if (combo) comboEl.textContent = 'COMBO \u00D7' + combo; comboEl.classList.toggle('on', combo > 0); lastCombo = combo; }
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
    // lane press flash (lilac, 220 ms)
    for (var l = 0; l < 4; l++) {
      var a = 1 - (now - laneFlash[l]) / 220;
      if (a > 0) { ctx.fillStyle = 'rgba(185,166,255,' + (0.35 * a) + ')'; ctx.fillRect(LX + l * LP, TOP, LW, H - TOP); }
    }
    // tiles (clipped so they emerge from the top of the lanes, never over the HUD)
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
      if (y - TH / 2 > H) continue;
      if (n.result === 'miss') ctx.globalAlpha = 0.35;
      ctx.drawImage(n.gold ? goldImg : tiles[shade[i]], cardX(n.lane) - SP, Math.round(y - TH / 2) - SP);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.drawImage(pads, 0, PY);
    // gold tiles waiting for the 2nd tap: hover on the pad and pulse
    for (var g = 0; g < 4; g++) {
      if (!S.pendingGold[g]) continue;
      var gx = cardX(g) + TW / 2, p = 1 + 0.06 * Math.sin(now / 45);
      put(goldImg, gx, HIT, p);
      put(TXT.tap, gx, HIT - TH / 2 - 44, 1);
    }
    // effects
    var keep = [];
    for (var k = 0; k < fx.length; k++) {
      var f = fx[k], age = t - f.t;
      if (age > 600) continue; keep.push(f);
      var fx0 = cardX(f.lane) + TW / 2, k1 = age / 600, e = 1 - (1 - k1) * (1 - k1); // e: ease-out
      ctx.globalAlpha = 1 - k1;
      // sparkle_pearl 300 px growing 0.4→1 on the pad + small sparkle_butter up-right (mockup offsets)
      if (f.burst && pearl) put(pearl, fx0 + 8, HIT - 29, 0.4 + 0.6 * e); // mockup: centre (+8, -29) from the pad centre
      if (f.burst && butter) put(butter, fx0 + 83 + 20 * e, HIT - 125 - 20 * e, 0.6 + 0.4 * e);
      if (f.empty) { ctx.strokeStyle = '#9A8F88'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(fx0, HIT, 40 + 30 * k1, 0, Math.PI * 2); ctx.stroke(); }
      if (f.text) put(TXT[f.text], fx0, HIT - TH / 2 - 66 - 60 * e, 1); // floats up 60 px
      ctx.globalAlpha = 1;
    }
    fx = keep;

    hud(Math.max(0, T.durationMs - t), S.score, S.combo);

    if (t >= T.durationMs + 400) { var cb = onEnd; stop(); if (cb) cb(S); }
  }

  window.TaptapGame = { init: init, start: start, stop: stop, clock: function () { return performance.now() - t0; } };
})();
