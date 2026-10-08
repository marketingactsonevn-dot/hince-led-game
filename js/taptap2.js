/* Tap-Tap! 2 (v2.2, v2.6 paper parts: carriage / cable / head from design/v26_kit/geometry.json) — claw machine: the claw slides by itself, a tap anywhere drops it onto the named Radiance Balm.
   Logic: Logic2.Taptap2Session (drop(ms) takes the raw clock and applies Admin's latencyMs itself).
   Per frame only #t2-rig moves (translateX = claw x); every sequence is Web Animations on transform/opacity.
   #s-taptap2[data-st] = moving (a tap is accepted) | anim | over | off. Packshots: never filtered or recoloured. */
(function () {
  'use strict';
  var G = Logic2.GRAB, SX = G.slotX, N = G.grabs;
  var DOWN = 350, BALM_TOP = 1120, TRAY_Y = 1538 - BALM_TOP, TRAY_S = 96 / 286; // head top 637 -> 987 (tips 862 -> 1212); won balm in the tray: top 1538 (= CSS .t2-tray top 1530 + 8), h 96
  // per-grab timeline (ms after the tap), TASK §3.2
  var T_CLOSE = 500, T_LIFT = 570, T_SLIP = 700, T_OPEN = 1070, T_LAND = 1570, T_SHUF = 1870, T_RESUME = 2320, GHOST_MS = 150, END_MS = 900;
  var el = {}, scr = null, S = null, onEnd = null, state = 'off', raf = 0, run = false, t0 = 0, lastX = 0, left = false;
  var balms = [], shads = [], trays = [], bulbs = null, timers = [], anims = [];

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function after(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function anim(node, kf, opt) { var a = node.animate(kf, opt); anims.push(a); return a; }
  function clearFx() { timers.forEach(clearTimeout); timers = []; anims.forEach(function (a) { a.cancel(); }); anims = []; }
  function bt(x, y, s) { return 'translate(' + x.toFixed(1) + 'px,' + y + 'px)' + (s ? ' scale(' + s + ')' : ''); }
  function rigX(x) { el.rig.style.transform = 'translateX(' + x.toFixed(1) + 'px)'; }
  // node to transform `to` (inline, so cancel() leaves it there), tweened from `from`
  function tw(node, from, to, ms, ease) { node.style.transform = to; anim(node, [{ transform: from }, { transform: to }], { duration: ms, easing: ease || 'linear' }); }
  function fade(node, to, ms) { var a = getComputedStyle(node).opacity; node.style.opacity = to; anim(node, [{ opacity: a }, { opacity: to }], { duration: ms }); }
  function pop(node) {
    node.style.visibility = 'visible';
    anim(node, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }
  function hide(node) { node.style.visibility = 'hidden'; }
  function setState(s) { state = s; scr.setAttribute('data-st', s); }
  function clock() { return performance.now() - t0; }
  // grab_move motor hum: a loop with start/stop (Sfx.loopStart / loopStop, audio.js)
  function motor(on) { if (on) Sfx.loopStart('grab_move'); else Sfx.loopStop('grab_move'); }

  function init() {
    scr = $('s-taptap2');
    ['t2-score', 't2-grab', 't2-target', 't2-tgt-img', 't2-tgt-name', 't2-rig', 't2-speed', 't2-cable', 't2-claw', 't2-burst', 't2-pts', 't2-word'].forEach(function (id) { el[id.slice(3)] = $(id); });
    bulbs = $('t2-bulbs');
    var h = '', i;
    for (i = 0; i < 11; i++) h += '<i class="fx-blink' + (i % 2 ? ' d1' : '') + '" style="left:' + (112 + 80 * i) + 'px"></i>';
    bulbs.innerHTML = h;
    h = ''; for (i = 0; i < N; i++) h += '<div class="t2-shad" style="left:' + (SX[i] - 48) + 'px"></div>';
    $('t2-shads').innerHTML = h; shads = $('t2-shads').children;
    h = ''; for (i = 0; i < N; i++) h += '<div class="t2-tray" style="left:' + (94 + 130 * i) + 'px"><img src="' + ASSETS.head(ASSETS.RB[0]) + '" alt=""></div>'; // v2.6: won = bullet close-up
    $('t2-trays').innerHTML = h; trays = $('t2-trays').children;
    h = ''; for (i = 0; i < N; i++) h += '<div class="t2-balm" data-balm="' + i + '"><img class="prod" src="' + ASSETS.rb(ASSETS.RB[i]) + '" alt=""></div>';
    $('t2-balms').innerHTML = h; balms = $('t2-balms').children;
    scr.addEventListener('pointerdown', onDown);
    reset();
  }

  // clean look without a session (App.home can stop us at any moment; the next game starts clean)
  function reset() {
    clearFx(); run = false; S = null; onEnd = null;
    setState('off');
    el.score.textContent = '0'; el.grab.textContent = '1/' + N;
    for (var i = 0; i < N; i++) {
      trays[i].className = 't2-tray';
      shads[i].style.opacity = '';
      balms[i].style.transform = bt(SX[i], 0); balms[i].style.opacity = ''; balms[i].style.zIndex = '';
    }
    el.claw.classList.remove('closed'); el.claw.style.transform = ''; el.cable.style.transform = '';
    rigX(G.railMin); lastX = G.railMin; left = false; el.speed.classList.remove('l');
    hide(el.pts); hide(el.word);
    el.burst.className = 'abs up-burst';
    bulbs.classList.remove('chase');
  }

  function start(session, cbEnd) {
    reset();
    S = session; onEnd = cbEnd;
    var g = S.grab();
    for (var k = 0; k < N; k++) balms[g.layout[k]].style.transform = bt(SX[k], 0);
    showTarget(g);
    setState('anim');
    rigX(S.clawX(0)); lastX = S.clawX(0);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    after(resume, 300);
  }
  function halt() { cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; run = false; motor(false); onEnd = null; setState('over'); }
  function stop() { halt(); reset(); } // every animation cancelled, no timer left: no callback fires later
  function finish() { var cb = onEnd; halt(); if (cb) cb(S); }

  function showTarget(g) {
    el['tgt-img'].src = ASSETS.head(ASSETS.RB[g.target]); // v2.6 swatch: square bullet close-up, 124x124
    el['tgt-name'].textContent = ASSETS.RB_NAMES[g.target].toLowerCase().replace(/(^| )\w/g, function (c) { return c.toUpperCase(); }); // Shelly Pink
    el.grab.textContent = (g.i + 1) + '/' + N;
    anim(el.target, [{ transform: 'rotate(-1deg) scale(.96)' }, { transform: 'rotate(-1deg) scale(1)' }], { duration: 200, easing: 'ease-out' }); // paper pop
  }
  // the claw starts moving from its start side; taps count GHOST_MS later
  function resume() {
    t0 = performance.now(); run = true; motor(true);
    bulbs.classList.remove('chase');
    after(function () { setState('moving'); }, GHOST_MS);
  }

  // ---------- per frame: one transform write (rig); the trail lines flip only when the direction changes ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!run) return;
    var x = S.clawX(now - t0);
    rigX(x);
    if (x !== lastX && (x < lastX) !== left) { left = x < lastX; el.speed.classList.toggle('l', left); }
    lastX = x;
    if (state === 'moving' && clock() >= G.idleMs) drop(); // no tap for 8 s: the claw drops by itself
  }

  // ---------- input: a tap anywhere on the screen (incl. GẮP!), first pointer only, one drop per grab ----------
  // judged at the event's own timestamp (as Tap-Tap! 1) so a busy frame does not shift the claw x; the session subtracts latencyMs
  function onDown(e) {
    if (state !== 'moving' || e.isPrimary === false) return;
    var now = performance.now(), stamp = (typeof e.timeStamp === 'number' && Math.abs(e.timeStamp - now) < 1000) ? e.timeStamp : now;
    drop(stamp - t0);
  }

  function drop(ms) {
    var g = S.grab(), j = S.drop(ms === undefined ? clock() : ms);
    if (!j) return;
    S.next();
    run = false; motor(false); setState('anim');
    Sfx.play('grab_drop');
    rigX(j.x); lastX = j.x;
    el.burst.className = 'abs up-burst';
    var b = j.balm === null ? null : balms[j.balm], sx = j.slot === null ? 0 : SX[j.slot];
    // 0–450: descend (ease-in); the cable stretches with the same curve
    tw(el.claw, 'translateY(0px)', 'translateY(' + DOWN + 'px)', 450, 'ease-in');
    tw(el.cable, 'scaleY(1)', 'scaleY(' + (36 + DOWN) / 36 + ')', 450, 'ease-in'); // v2.6 cable rest height 36
    after(function () { el.claw.classList.add('closed'); Sfx.play('grab_close'); }, T_CLOSE);
    // 570–1070: lift (linear); a caught balm rises with it, its top 130 px below the claw top
    after(function () {
      tw(el.claw, 'translateY(' + DOWN + 'px)', 'translateY(0px)', T_OPEN - T_LIFT);
      tw(el.cable, 'scaleY(' + (36 + DOWN) / 36 + ')', 'scaleY(1)', T_OPEN - T_LIFT);
      if (!b) { word('MISS'); Sfx.play('grab_miss'); return; }
      fade(shads[j.slot], 0, 150);
      if (j.result === 'got') return tw(b, bt(sx, 0), bt(j.x, -DOWN), T_OPEN - T_LIFT);
      // wrong: rises until 700 (claw top ~900), slips out, falls back to its slot with a small bounce by 1050
      var k = (T_SLIP - T_LIFT) / 480, up = -DOWN * (T_SLIP - T_LIFT) / (T_OPEN - T_LIFT);
      anim(b, [{ transform: bt(sx, 0) }, { transform: bt(sx, up), offset: k, easing: 'ease-in' }, { transform: bt(sx, 0), offset: 0.7, easing: 'ease-out' },
        { transform: bt(sx, -18), offset: 0.85, easing: 'ease-in' }, { transform: bt(sx, 0) }], { duration: 480 });
    }, T_LIFT);
    if (j.result === 'wrong') {
      after(function () { word('OOPS'); Sfx.play('grab_slip'); }, T_SLIP);
      after(function () { fade(shads[j.slot], 1, 150); }, 1050);
    }
    after(function () { el.claw.classList.remove('closed'); if (j.result === 'got') got(g, j, b); }, T_OPEN);
    after(function () {
      if (j.result === 'got') { b.style.opacity = 0; b.style.zIndex = ''; trays[g.i].className = 't2-tray on'; trays[g.i].firstChild.src = ASSETS.head(ASSETS.RB[g.target]); }
      if (S.done()) { setState('over'); return after(finish, END_MS); }
      if (j.result === 'got') { // refill: a new balm of the same shade drops into the empty slot (300 ms)
        b.style.opacity = '';
        tw(b, bt(sx, -320), bt(sx, 0), 300, 'ease-in');
        anim(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
        fade(shads[j.slot], 1, 300);
      }
      after(function () { shuffle(g, S.grab()); }, T_SHUF - T_LAND);
      after(resume, T_RESUME - T_LAND);
    }, T_LAND);
  }

  // got (1070–1570): the balm flies on an arc into tray slot i (shrinking to h 96), GOT IT! + points + sparkles, bulbs chase
  function got(g, j, b) {
    var tx = 150 + 130 * g.i, mx = j.x + (tx - j.x) * 0.4;
    trays[g.i].className = 't2-tray cur';
    b.style.zIndex = 1; // flies in front of the other balms
    b.style.transform = bt(tx, TRAY_Y, TRAY_S);
    anim(b, [{ transform: bt(j.x, -DOWN, 1), easing: 'ease-out' }, { transform: bt(mx, -DOWN - 90, 0.75), offset: 0.4, easing: 'ease-in' }, { transform: bt(tx, TRAY_Y, TRAY_S) }],
      { duration: T_LAND - T_OPEN });
    el.score.textContent = fmt(S.score);
    word('GOT IT!');
    el.pts.firstChild.textContent = '+' + j.points;
    // +points beside the claw on the roomier side; the sparkle burst mirrors with it, its x clamped so all 4 stickers stay inside the glass
    var r = j.x >= 560;
    el.pts.style.left = r ? '' : j.x + 160 + 'px'; el.pts.style.right = r ? 1080 - j.x + 160 + 'px' : '';
    pop(el.pts);
    var bx = Math.max(320, Math.min(760, j.x));
    el.burst.style.transform = 'translateX(' + bx + 'px)' + (r ? ' scaleX(-1)' : '');
    el.burst.className = 'abs up-burst go';
    bulbs.classList.add('chase');
    Sfx.play('grab_got');
  }
  function word(txt) { el.word.textContent = txt; el.word.classList.toggle('miss', txt !== 'GOT IT!'); pop(el.word); } // MISS / OOPS grey

  // ~1870: every balm hops 60 px and slides to its slot in the next layout (450 ms), new target, claw glides to its start side
  function shuffle(g, ng) {
    hide(el.word); hide(el.pts);
    for (var k = 0; k < N; k++) {
      var b = balms[k], x0 = SX[g.layout.indexOf(k)], x1 = SX[ng.layout.indexOf(k)];
      b.style.transform = bt(x1, 0);
      anim(b, [{ transform: bt(x0, 0), easing: 'ease-out' }, { transform: bt((x0 + x1) / 2, -60), easing: 'ease-in' }, { transform: bt(x1, 0) }], { duration: 450 });
    }
    Sfx.play('grab_shuffle');
    showTarget(ng);
    var x = lastX, sx = ng.dir > 0 ? G.railMin : G.railMax;
    lastX = sx; left = ng.dir < 0; el.speed.classList.toggle('l', left);
    tw(el.rig, 'translateX(' + x.toFixed(1) + 'px)', 'translateX(' + sx + 'px)', 400, 'ease-in-out');
  }

  window.Taptap2Game = { init: init, start: start, stop: stop, clock: clock };
})();
