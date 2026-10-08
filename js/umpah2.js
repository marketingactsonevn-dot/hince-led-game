/* Um-Pah! 2 (v2.2) — a real Nu Blur lip photo; drag (or tap) the matching tube up onto the lips. Logic: Logic2.Umpah2Session.
   Tubes = .u2-tube wrappers (canvas coords) moved only by transform: pointer drag + Web Animations for every sequence.
   #s-umpah2[data-st] = ready (tubes touchable, S.activeMs timer runs: Dễ 40 / Vừa 30 / Khó 24 s) | anim (sequence: input ignored, timer paused) | over | off.
   Lip photos are the colour reference: opacity/transform only, never a filter. */
(function () {
  'use strict';
  var K = Logic2.KISS;
  // v2.6.1 paper layout: tubes stand on the shelf (top 1080, 440 tall), photo 796x600 at (142,378) in the polaroid (120,296 −1.5°)
  var PED = [250, 540, 830], CY = 1300, HALF = 220;   // tube centres: tag centre x, tube top 1080 + 440 / 2 (= CSS .u2-tube top)
  var KX = 502, KY = 755, KR = -14, KS = 0.91;         // kiss: cap tip on the lower-lip centre of every photo (same photo point as v2.4), tilted −14°
  var DROP = [60, 236, 1020, 940];                      // the polaroid (120,296 840x704) + 60 px, bottom 940: a lifted tube's cap rests at ~989,
                                                        // so it must still go up >= 49 px before a release counts (same threshold as v2.4)
  var TAP_MS = 250, TAP_PX = 24, HOME = { x: 0, y: 0, r: 0, s: 1 }, FLY = 'cubic-bezier(.4,0,.2,1)';
  var LR = 8, LS = 1.06, LA = LR * Math.PI / 180;      // lifted tube: tilt 8° + scale 1.06 (mockup ?s=kiss)
  var el = {}, scr = null, stage = null, S = null, onEnd = null, state = 'off', raf = 0;
  var tubes = [], peds = [], prog = [], phs = [], seg = [], front = 0, puff = [], timers = [], anims = [];
  var used = 0, lipUsed = 0, readyAt = 0, drag = null, shownSec = -1, shownSeg = -1;

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); } // v2.6 HUD 0:31
  var LIP = 'assets/v26/stickers/p_lips.svg'; // v2.6 progress sticker
  function after(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function anim(node, kf, opt) { var a = node.animate(kf, opt); anims.push(a); return a; }
  function clearFx() { timers.forEach(clearTimeout); timers = []; anims.forEach(function (a) { a.cancel(); }); anims = []; }
  function css(p) { return 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) rotate(' + p.r + 'deg) scale(' + p.s + ')'; }
  // tube t to pose p (tweened when ms); the inline style already holds p, so cancel() (stop / next lip) leaves it there
  function move(t, p, ms, ease) {
    var a = css(t.p); t.p = p; t.el.style.transform = css(p);
    if (ms) anim(t.el, [{ transform: a }, { transform: css(p) }], { duration: ms, easing: ease });
  }
  function fade(node, to, ms) { var a = getComputedStyle(node).opacity; node.style.opacity = to; anim(node, [{ opacity: a }, { opacity: to }], { duration: ms }); }
  // entrance like .fx-pop (scale .6 -> 1 + fade in) for a node with no static transform (rotations sit on its child)
  function pop(node, delay) {
    node.style.visibility = 'visible';
    anim(node, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, delay: delay || 0, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' });
  }
  function hide(node) { node.style.visibility = 'hidden'; }
  function setState(s) { state = s; scr.setAttribute('data-st', s); }
  function setReady() { readyAt = performance.now(); setState('ready'); }
  function tubeOf(key) { for (var k = 0; k < tubes.length; k++) if (tubes[k].key === key) return tubes[k]; }
  // pose that puts the cap tip (local 0,-220 about the centre) on the kiss point
  function kissPose(slot) { var a = KR * Math.PI / 180; return { x: KX - PED[slot] - HALF * KS * Math.sin(a), y: KY - CY + HALF * KS * Math.cos(a), r: KR, s: KS }; }
  function shadeName(key) { var i = ASSETS.NB.indexOf(key); return (i < 9 ? '0' : '') + (i + 1) + ' ' + ASSETS.NB_NAMES[i].toUpperCase(); }

  function init() {
    scr = $('s-umpah2'); stage = $('stage');
    ['u2-score', 'u2-time', 'u2-prog', 'u2-photo', 'u2-name', 'u2-hint', 'u2-burst', 'u2-puff', 'u2-stamp', 'u2-stamp-t', 'u2-pts', 'u2-oops', 'u2-big'].forEach(function (id) { el[id] = $(id); });
    seg = $('u2-seg').children;
    phs = scr.querySelectorAll('.u2-photo .ph');
    peds = scr.querySelectorAll('.u2-ped');
    [].forEach.call(scr.querySelectorAll('.u2-tube'), function (n, k) { tubes.push({ el: n, img: n.firstElementChild, slot: k, key: '', p: HOME, used: false, busy: 0 }); });
    var h = '', i, a, d, sz;
    for (i = 0; i < K.lips; i++) h += '<img class="todo" src="' + LIP + '" alt="">';
    el['u2-prog'].innerHTML = h; prog = el['u2-prog'].children;
    // powder puff: the same 10 soft dots as Um-Pah! 1, centred on the kiss point by CSS
    h = '';
    for (i = 0; i < 10; i++) {
      a = (i * 36 + (i % 3) * 11) * Math.PI / 180; d = 40 + (i * 29) % 81; sz = 14 + (i * 7) % 11;
      h += '<i style="width:' + sz + 'px;height:' + sz + 'px;margin:' + (-sz / 2) + 'px 0 0 ' + (-sz / 2) + 'px"></i>';
      puff.push({ dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d * 0.7) });
    }
    el['u2-puff'].innerHTML = h;
    for (i = 0; i < puff.length; i++) puff[i].el = el['u2-puff'].children[i];
    scr.addEventListener('pointerdown', onDown);
    scr.addEventListener('pointermove', onMove);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { scr.addEventListener(ev, onUp); });
    reset();
  }

  // clean look without a session (App.home can stop us at any moment; the next game starts clean)
  function reset() {
    clearFx(); drag = null; S = null; onEnd = null;
    setState('off');
    el['u2-score'].textContent = '0';
    for (var i = 0; i < prog.length; i++) prog[i].className = 'todo';
    el['u2-prog'].classList.remove('end');
    el['u2-photo'].classList.remove('drop');
    el['u2-hint'].style.opacity = '';
    clearLip();
  }
  function clearLip() {
    [el['u2-name'], el['u2-stamp'], el['u2-pts'], el['u2-oops'], el['u2-big']].forEach(hide);
    el['u2-burst'].className = 'up-burst';
    tubes.forEach(function (t) { move(t, HOME); t.el.style.opacity = ''; t.el.classList.remove('lift'); t.used = false; t.busy = 0; });
    for (var k = 0; k < peds.length; k++) peds[k].classList.remove('ghost');
  }

  function start(session, cbEnd) {
    reset();
    S = session; onEnd = cbEnd; used = 0; paintTime(S.activeMs); // the session's time (difficulty: Dễ 40 s / Vừa 30 s / Khó 24 s)
    showLip(true);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function halt() { cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; drag = null; onEnd = null; setState('over'); }
  function stop() { halt(); reset(); } // every animation cancelled, no timer left: no callback fires later
  function finish() { var cb = onEnd; halt(); el['u2-photo'].classList.remove('drop'); if (cb) cb(S); }

  // next lip: the new photo cross-fades in on top (250 ms, first lip at once), 3 new tubes pop onto the pedestals (stagger 80 ms)
  function showLip(first) {
    var L = S.lip(), b = phs[1 - front];
    clearFx(); clearLip(); lipUsed = 0; setState('anim');
    b.src = ASSETS.photo(ASSETS.NB.indexOf(L.target));
    b.style.zIndex = 1; phs[front].style.zIndex = 0; front = 1 - front;
    if (!first) anim(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    L.choices.forEach(function (key, k) {
      var t = tubes[k]; t.key = key; t.el.setAttribute('data-shade', key); t.img.src = ASSETS.nb(key); peds[k].textContent = shadeName(key);
      anim(t.el, [{ transform: css({ x: 0, y: HALF, r: 0, s: 0.01 }), opacity: 0 }, { transform: css(HOME), opacity: 1 }],
        { duration: 220, delay: k * 80, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' });
    });
    after(setReady, 2 * 80 + 220);
  }

  // ---------- timer: S.activeMs of touchable time (runs only in 'ready') ----------
  function left(now) { return S.activeMs - used - (state === 'ready' ? now - readyAt : 0); }
  function bank(now) { if (state === 'ready') { used += now - readyAt; lipUsed += now - readyAt; } } // leaving 'ready'
  function paintTime(ms) { // DOM writes only on change
    var s = Math.max(0, Math.ceil(ms / 1000)), n = Math.max(0, Math.ceil(seg.length * ms / S.activeMs));
    if (s !== shownSec) { shownSec = s; el['u2-time'].textContent = mmss(ms); }
    if (n !== shownSeg) { shownSeg = n; for (var k = 0; k < seg.length; k++) seg[k].classList.toggle('on', k < n); }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (state !== 'ready') return;
    var ms = left(Math.max(now, readyAt)); paintTime(ms);
    if (ms <= 0) timeUp(now);
  }
  function timeUp(now) {
    bank(now); setState('over'); paintTime(0);
    if (drag) { var t = drag.t; drag = null; move(t, HOME, 300, 'ease-out'); after(function () { t.el.classList.remove('lift'); peds[t.slot].classList.remove('ghost'); }, 300); }
    el['u2-photo'].classList.remove('drop');
    S.timeUp();
    pop(el['u2-big']); Sfx.play('time_up');
    after(finish, 900);
  }

  // ---------- input: first pointer only; drag keeps the grab offset; tap (<= 250 ms, <= 24 px) = the tube flies by itself ----------
  function pt(e) { var r = stage.getBoundingClientRect(), k = 1080 / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; }
  function inDrop(x, y) { return x >= DROP[0] && y >= DROP[1] && x <= DROP[2] && y <= DROP[3]; }
  function onDown(e) {
    var n = e.target.closest ? e.target.closest('.u2-tube') : null, now = performance.now();
    if (state !== 'ready' || drag || !n || e.isPrimary === false) return;
    var t = tubes[+n.getAttribute('data-slot')], p = pt(e);
    if (t.used || now < t.busy) return;
    drag = { t: t, id: e.pointerId, x: p.x, y: p.y, at: now };
    try { scr.setPointerCapture(e.pointerId); } catch (x) { }
    t.el.classList.add('lift'); peds[t.slot].classList.add('ghost'); el['u2-photo'].classList.add('drop');
    move(t, { x: 0, y: 0, r: LR, s: LS });
    Sfx.play('kiss_pick');
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id || state !== 'ready') return;
    var p = pt(e);
    move(drag.t, { x: p.x - drag.x, y: p.y - drag.y, r: LR, s: LS });
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag, t = d.t, now = performance.now(), p, dx, dy;
    drag = null; el['u2-photo'].classList.remove('drop');
    if (state !== 'ready') return;
    if (e.type === 'pointerup') {
      p = pt(e); dx = p.x - d.x; dy = p.y - d.y;
      if (now - d.at <= TAP_MS && dx * dx + dy * dy <= TAP_PX * TAP_PX) return submit(t, now, true);
      // finger, or the lifted tube's cap (top-centre, tilted + scaled about its centre), over the photo window + 60 px
      if (inDrop(p.x, p.y) || inDrop(PED[t.slot] + dx + HALF * LS * Math.sin(LA), CY + dy - HALF * LS * Math.cos(LA))) return submit(t, now, false);
    }
    t.busy = now + 300; // released elsewhere: spring back, no penalty
    move(t, HOME, 300, 'cubic-bezier(.3,1.4,.5,1)');
    after(function () { if (!drag || drag.t !== t) { t.el.classList.remove('lift'); peds[t.slot].classList.remove('ghost'); } }, 300);
  }

  // ---------- sequences (TASK §2.2) ----------
  function submit(t, now, tap) {
    bank(now); setState('anim');
    var j = S.pick(t.key, lipUsed), fly = tap ? 350 : 300, t0 = 0;
    if (el['u2-hint'].style.opacity !== '0') fade(el['u2-hint'], 0, 300); // lip 1 hint goes after the first pick
    if (j.result === 'first' || j.result === 'second') return kiss(t, j, fly);
    if (tap) { move(t, kissPose(t.slot), fly, FLY); t0 = fly; } // a tapped tube flies up to the lips first
    after(function () { oops(t); }, t0);
    if (j.result === 'wrong') after(setReady, t0 + 600);
    else after(function () { kiss(tubeOf(j.target), j, 300); }, t0 + 600); // missed: the right tube flies by itself
  }
  // wrong tube: shake ±14 px ×3 (300 ms) + OOPS, back to its pedestal at 35 % (300 ms), not pickable again
  function oops(t) {
    var p = t.p, f = [], k, o = el['u2-oops'];
    for (k = 0; k < 8; k++) f.push({ transform: css({ x: p.x + (k % 7 ? (k % 2 ? -14 : 14) : 0), y: p.y, r: p.r, s: p.s }) });
    anim(t.el, f, { duration: 300 });
    Sfx.play('kiss_wrong');
    o.style.left = Math.min(860, PED[t.slot] + p.x + 50) + 'px'; o.style.top = (CY - HALF + p.y - 40) + 'px';
    pop(o);
    after(function () { move(t, HOME, 300, 'ease-in-out'); fade(t.el, 0.35, 300); t.used = true; }, 300);
    after(function () { hide(o); t.el.classList.remove('lift'); peds[t.slot].classList.remove('ghost'); }, 600);
  }
  // 0..fly: the tube flies onto the lips (tilt −14°) · fly: impact · +100: shade name + progress lip · +800: tubes fade · +1000: next lip
  function kiss(t, j, fly) {
    var i = S.i, miss = j.result === 'missed', last;
    S.next(); last = S.done();
    t.el.classList.add('lift'); peds[t.slot].classList.add('ghost');
    move(t, kissPose(t.slot), fly, FLY);
    after(function () { impact(t, j, miss); }, fly);
    after(function () { lipDone(i, j.target, miss); }, fly + 100);
    after(function () { tubes.forEach(function (u) { fade(u.el, 0, 200); }); }, fly + 800);
    if (!last) return after(function () { showLip(false); }, fly + 1000);
    after(function () { el['u2-prog'].classList.add('end'); }, fly + 400); // all 10 done: progress lips blink together, 900 ms -> RESULT
    after(finish, fly + 1300);
  }
  // photo window squash, UM-PAH! (or THIS ONE! on a miss) stamp, +points, sticker burst + powder puff (as Um-Pah! 1)
  function impact(t, j, miss) {
    Sfx.play(miss ? 'kiss_this' : 'kiss_color');
    t.el.classList.remove('lift');
    el['u2-score'].textContent = fmt(S.score);
    anim(el['u2-photo'], [{ transform: 'rotate(-1.5deg) scale(.97)' }, { transform: 'rotate(-1.5deg) scale(1.02)', offset: 0.5 }, { transform: 'rotate(-1.5deg) scale(1)' }], { duration: 250, easing: 'ease-out' });
    el['u2-stamp-t'].textContent = miss ? 'THIS ONE!' : 'Um-Pah!'; pop(el['u2-stamp']);
    if (!miss) { el['u2-pts'].firstChild.textContent = '+' + j.points; pop(el['u2-pts'], 80); }
    el['u2-burst'].className = 'up-burst go'; // clearLip reset the class at the lip start = the CSS burst restarts
    puff.forEach(function (q) {
      anim(q.el, [{ transform: 'translate(0px,0px) scale(.6)', opacity: 0.9 }, { transform: 'translate(' + q.dx + 'px,' + q.dy + 'px) scale(1.2)', opacity: 0 }],
        { duration: 500, easing: 'cubic-bezier(.2,.7,.4,1)' });
    });
    tubes.forEach(function (u) { if (u !== t && !u.used) fade(u.el, 0.35, 200); });
  }
  function lipDone(i, key, miss) {
    var n = prog[i];
    n.className = miss ? 'miss' : '';
    if (!miss) anim(n, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
    el['u2-name'].textContent = shadeName(key); pop(el['u2-name']);
  }

  window.Umpah2Game = { init: init, start: start, stop: stop };
})();
