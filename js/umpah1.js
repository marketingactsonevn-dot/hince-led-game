/* Um-Pah! 1 (v2.3) "Lật Cặp Môi" — lip-photo memory game. Logic: Logic2.Umpah1Session (deck, flip, hideOpen, complete, timeUp).
   12 .m-card[data-i] (v2.6.1: 6 pairs, 3 cols x 4 rows, index = row * 3 + col) built here: .m-card (open lift / hit scale, hit area + 8 px) > .m-in (rotateY flip,
   Web Animations) > .mc.back (8-bit tube) + .mc.face (lip photo + shade name). Transform/opacity only.
   #s-umpah[data-st] = peek (wave up, timer frozen, wave down) | ready (taps accepted, timer runs) | anim (a pair resolving,
   timer paused) | over | off. Lip photos are colour references: opacity/transform only, never a filter. */
(function () {
  'use strict';
  var M = Logic2.MEMO, N = M.cols * M.rows, LIP = 'assets/v26/stickers/p_lips.svg'; // v2.6 progress sticker (grey = not yet)
  // v2.6.1 grid: 3 cols x 4 rows of 260x320 cards, steps 288 / 342, centred (x 122..958, y 300..1646); = CSS #s-umpah .m-card
  var GX = 122, GY = 300, CW = 260, CH = 320, SX = 288, SY = 342;
  function cx(i) { return GX + SX * (i % M.cols); } function cy(i) { return GY + SY * Math.floor(i / M.cols); }
  var FLIP = 240, WAVE = 40, BANNER = 700, AGAIN = 400, BACK = 700, CLEAR = 1200, TIMEUP = 900, COMBO = 900;
  var el = {}, scr = null, grid = null, S = null, onEnd = null, state = 'off', raf = 0;
  var cards = [], prog = [], seg = [], timers = [], anims = [];
  var used = 0, readyAt = 0, shownSec = -1, shownSeg = -1, bandSeq = 0, comboSeq = 0;
  var cnt = { from: 0, to: 0, val: 0, t0: 0 }, bonus = null; // bonus: CLEAR! '+<n>' count-in

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); } // v2.6 HUD 0:31
  function after(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function anim(node, kf, opt) { var a = node.animate(kf, opt); anims.push(a); return a; }
  function clearFx() { timers.forEach(clearTimeout); timers = []; anims.forEach(function (a) { a.cancel(); }); anims = []; }
  function setState(s) { state = s; scr.setAttribute('data-st', s); }
  function setReady() { readyAt = performance.now(); setState('ready'); }
  function pop(node, delay) { // like .fx-pop
    anim(node, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, delay: delay || 0, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' });
  }
  // banner / combo / line visibility; show() and hide() drop a fade still running on the node
  function show(node) { if (node._fade) node._fade.cancel(); node.style.opacity = ''; node.style.visibility = 'visible'; }
  function hide(node) { if (node._fade) node._fade.cancel(); node.style.opacity = ''; node.style.visibility = 'hidden'; }
  function fadeOut(node, ms, seqOk) { // seqOk(): still the same banner / combo when the fade ends
    node.style.opacity = 0; node._fade = anim(node, [{ opacity: 1 }, { opacity: 0 }], { duration: ms });
    after(function () { if (seqOk()) hide(node); }, ms);
  }

  function init() {
    scr = $('s-umpah'); grid = $('m-grid');
    ['m-score', 'm-time', 'm-prog', 'm-line', 'm-combo', 'm-band', 'm-band-t', 'm-band-s', 'm-burst-a', 'm-burst-b'].forEach(function (id) { el[id] = $(id); });
    seg = $('m-seg').children;
    var h = '', i;
    for (i = 0; i < N; i++) { // v2.6: back = paper card (azalea frame, Nu Rose −14°, "hince"), face = polaroid (lip photo + mono caption)
      h += '<div class="m-card" data-i="' + i + '" style="left:' + cx(i) + 'px;top:' + cy(i) + 'px"><div class="m-in">' +
        '<div class="mc back cb"><div class="in"></div><img src="' + ASSETS.nb('06_nu_rose') + '" alt=""><img class="lg" src="assets/img/logo.png" alt="hince"></div>' +
        '<div class="mc face cf"><img src="' + ASSETS.photo(5) + '" alt=""><span></span></div></div><i class="ok"></i></div>';
    }
    grid.innerHTML = h;
    [].forEach.call(grid.children, function (n) { cards.push({ el: n, inn: n.firstChild, img: n.querySelector('.face img'), name: n.querySelector('.face span'), up: false, a: null }); });
    h = '';
    for (i = 0; i < M.pairs; i++) h += '<img class="todo" src="' + LIP + '" alt="">';
    el['m-prog'].innerHTML = h; prog = el['m-prog'].children;
    scr.addEventListener('pointerdown', onDown);
    reset();
  }

  // clean look without a session (App.home can stop us at any moment; the next game starts clean)
  function reset() {
    clearFx(); S = null; onEnd = null;
    setState('off');
    cnt = { from: 0, to: 0, val: 0, t0: 0 }; bonus = null; el['m-score'].textContent = '0';
    paintTime(M.activeMs, M.activeMs);
    cards.forEach(function (c) { c.a = null; c.up = false; c.inn.style.transform = 'rotateY(0deg)'; c.el.className = 'm-card'; });
    grid.classList.remove('clear');
    for (var i = 0; i < prog.length; i++) prog[i].className = 'todo';
    el['m-line'].textContent = I18N.t('memo.peek'); show(el['m-line']);
    hide(el['m-combo']); hide(el['m-band']);
    el['m-burst-a'].className = el['m-burst-b'].className = 'up-burst';
  }

  function start(session, cbEnd) {
    reset();
    S = session; onEnd = cbEnd; used = 0;
    cards.forEach(function (c, i) { var k = ASSETS.NB.indexOf(S.deck[i]); c.img.src = ASSETS.photo(k); c.name.textContent = S.deck[i].slice(0, 2) + ' ' + ASSETS.NB_NAMES[k].toUpperCase(); c.el.setAttribute('data-shade', S.deck[i]); });
    paintTime(S.activeMs, S.activeMs);
    setState('peek');
    Sfx.play('peek'); wave(true);
    after(function () { wave(false); el['m-line'].textContent = I18N.t('memo.hint'); }, S.peekMs);
    after(setReady, S.peekMs + (N - 1) * WAVE + FLIP); // the timer starts when the last card is face-down
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function halt() { cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; onEnd = null; setState('over'); }
  function stop() { halt(); reset(); } // every animation cancelled, no timer left: no callback fires later
  function finish() { var cb = onEnd; halt(); el['m-score'].textContent = fmt(S.score); if (cb) cb(S); }

  // ---------- cards ----------
  // flip card c face-up (true) / face-down: inner wrapper rotateY over 240 ms (after delay ms); a running flip the other way
  // turns back from its current angle (playbackRate keeps currentTime, unlike reverse(); its 'from' frame = the new end), else replaced
  function flipTo(c, up, delay) {
    if (c.a && c.a.playState === 'running' && c.up !== up && !delay) { c.a.playbackRate = -c.a.playbackRate; c.up = up; c.inn.style.transform = 'rotateY(' + (up ? 180 : 0) + 'deg)'; return; }
    var from = c.up ? 180 : 0, to = up ? 180 : 0;
    if (c.a) c.a.cancel();
    c.up = up; c.inn.style.transform = 'rotateY(' + to + 'deg)';
    c.a = anim(c.inn, [{ transform: 'rotateY(' + from + 'deg)' }, { transform: 'rotateY(' + to + 'deg)' }], { duration: FLIP, delay: delay || 0, easing: 'ease-in-out', fill: 'backwards' });
  }
  function wave(up) { cards.forEach(function (c, i) { flipTo(c, up, i * WAVE); }); } // reading order, 40 ms stagger
  function wiggle(c) { // ±8 px × 2 in 240 ms, keeps the open lift
    var f = [0, -8, 8, -8, 8, 0].map(function (x) { return { transform: 'translate(' + x + 'px,-12px)' }; });
    anim(c.el, f, { duration: 240 });
  }
  function burst(node, i) { // sticker group onto the card centre, restart the CSS burst
    node.style.left = (cx(i) + CW / 2) + 'px'; node.style.top = (cy(i) + CH / 2) + 'px';
    node.className = 'up-burst'; void node.offsetWidth; node.className = 'up-burst go';
  }

  // ---------- timer: S.activeMs of touchable time (runs only in 'ready'), score count-up ----------
  function left(now) { return S.activeMs - used - (state === 'ready' ? now - readyAt : 0); }
  function bank(now) { if (state === 'ready') used += now - readyAt; } // leaving 'ready'
  function paintTime(ms, total) { // DOM writes only on change
    var s = Math.max(0, Math.ceil(ms / 1000)), n = Math.max(0, Math.ceil(seg.length * ms / total));
    if (s !== shownSec) { shownSec = s; el['m-time'].textContent = mmss(ms); }
    if (n !== shownSeg) { shownSeg = n; for (var k = 0; k < seg.length; k++) seg[k].classList.toggle('on', k < n); }
  }
  function countTo(v) { cnt.from = cnt.val; cnt.to = v; cnt.t0 = performance.now(); }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (cnt.val !== cnt.to) {
      var k = Math.max(0, Math.min(1, (now - cnt.t0) / 400)), v = k >= 1 ? cnt.to : Math.round(cnt.from + (cnt.to - cnt.from) * (1 - Math.pow(1 - k, 3)));
      if (v !== cnt.val) { cnt.val = v; el['m-score'].textContent = fmt(v); }
    }
    if (bonus) { var kb = Math.max(0, Math.min(1, (now - bonus.t0) / 400)); el['m-band-s'].textContent = '+' + fmt(Math.round(bonus.to * kb)); if (kb >= 1) bonus = null; }
    if (state !== 'ready') return;
    var ms = left(Math.max(now, readyAt)); paintTime(ms, S.activeMs);
    if (ms <= 0) timeUp(now);
  }

  // ---------- input: pointerdown, first pointer only ----------
  function onDown(e) {
    var n = e.target.closest ? e.target.closest('.m-card') : null;
    if (state !== 'ready' || !n || e.isPrimary === false) return;
    tap(+n.getAttribute('data-i'), performance.now());
  }
  function tap(i, now) {
    if (left(now) <= 0) return timeUp(now);
    var r = S.flip(i), c = cards[i], a;
    if (r.result === 'ignored') return;
    Sfx.play('card_flip');
    c.el.classList.add('open'); flipTo(c, true);
    if (r.result === 'first') return;
    bank(now); setState('anim');
    a = cards[r.a];
    if (r.result === 'nomatch') {
      after(function () { wiggle(a); wiggle(c); Sfx.play('card_nomatch'); }, FLIP);
      after(function () { S.hideOpen(); [a, c].forEach(function (x) { x.el.classList.remove('open'); flipTo(x, false); }); setReady(); }, FLIP + BACK);
      return;
    }
    after(function () { match(a, c, r); }, FLIP); // the moment starts when the 2nd card is face-up
  }

  // ---------- sequences (TASK_v2_3 A3) ----------
  // match: both cards hit + halo, pah + kiss_color, sticker bursts, banner UM-PAH! + shade name, progress lip, score count-up;
  // taps again from 400 ms; banner fades + cards done at 700 ms (last pair: CLEAR! then)
  function match(a, c, r) {
    var seq, lip = prog[r.pairsFound - 1];
    [a, c].forEach(function (x) { x.el.classList.remove('open'); x.el.classList.add('hit'); });
    Sfx.play('pah'); Sfx.play('kiss_color');
    burst(el['m-burst-a'], a.el.getAttribute('data-i')); burst(el['m-burst-b'], c.el.getAttribute('data-i'));
    seq = banner('Um-Pah!', '+' + fmt(S.score - cnt.to)); // v2.6: stamp + points (mono azalea-deep)
    lip.className = '';
    anim(lip, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
    countTo(S.score);
    if (r.pairsFound === 1) hide(el['m-line']);
    if (r.streak >= 2) combo(r.streak);
    if (!r.done) after(setReady, AGAIN);
    after(function () {
      [a, c].forEach(function (x) { x.el.classList.remove('hit'); x.el.classList.add('done'); });
      if (r.done) clear(); else bannerOff(seq);
    }, BANNER);
  }
  // all pairs (6): cards blink 3x, CLEAR! + time bonus, clear fanfare, 1200 ms -> RESULT
  function clear() {
    setState('over');
    var add = S.complete(S.activeMs - used);
    grid.classList.add('clear');
    banner('CLEAR!', add ? '+0' : ''); // the rAF counts it in with the score (runs until finish)
    if (add) bonus = { to: add, t0: performance.now() };
    countTo(S.score);
    Sfx.play('clear');
    after(finish, CLEAR);
  }
  function timeUp(now) {
    bank(now); setState('over'); paintTime(0, S.activeMs);
    S.timeUp().forEach(function (i) { cards[i].el.classList.remove('open'); flipTo(cards[i], false); });
    banner('TIME UP!', '');
    Sfx.play('time_up');
    after(finish, TIMEUP);
  }
  // full-width paper band: title (+ sub line); returns its sequence number for bannerOff
  function banner(t, sub) {
    var b = el['m-band'];
    el['m-band-t'].textContent = t; el['m-band-s'].textContent = sub;
    b.classList.toggle('solo', !sub);
    show(b); anim(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
    pop(el['m-band-t']); if (sub) pop(el['m-band-s'], 80);
    return ++bandSeq;
  }
  function bannerOff(seq) { if (seq === bandSeq) fadeOut(el['m-band'], 200, function () { return seq === bandSeq; }); }
  function combo(n) {
    var c = el['m-combo'], seq = ++comboSeq;
    c.textContent = 'COMBO ×' + n; show(c); pop(c);
    Sfx.play('combo_up');
    after(function () { if (seq === comboSeq) fadeOut(c, 200, function () { return seq === comboSeq; }); }, COMBO);
  }

  window.Umpah1Game = { init: init, start: start, stop: stop };
})();
