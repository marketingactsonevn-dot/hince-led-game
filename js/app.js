/* hince LED Game — main controller (screens, flow, form, reward, kiosk hardening). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var stage = $('stage');

  var App = {
    screen: '', game: '', session: null, result: null, settings: null,
    form: { name: '', phone: '', focus: 'name', cg: false, cm: false },
    timers: [], lastAct: performance.now(), idleWarn: false, idleLeft: 0, bootAt: performance.now(), homing: false,
    assetsReady: false, promoReady: false
  };
  window.App = App;

  // ---------------- game registry (v2.2): every per-game branch reads from here ----------------
  // module() / session() resolve lazily: umpah2.js / taptap2.js / logic2.js may not be loaded.
  // start(S) starts the module with its own signature (Um-Pah! 1 resets its HUD first).
  var TH_NB = 'thanks.nb', TH_RB = 'thanks.rb'; // i18n keys (THANKS line per product)
  function T(k, v) { return I18N.t(k, v); }
  function en() { return I18N.lang === 'en'; }
  // Tap-Tap! 1 max varies per chart (and per difficulty, v2.3 D): average of 40 fixed charts of that level
  function tilesMaxAvg(d) { var sum = 0; for (var i = 1; i <= 40; i++) sum += Logic.chartMax(Logic.buildChart(i * 7919, Logic.TILES_LEVELS[d])); return Math.round(sum / 40); }
  function lvl(k) { return (App.settings.difficulty || {})[k] || 'normal'; } // v2.3 D: Control Center difficulty for game k
  var GAME = {
    // v2.3: Um-Pah! 1 = "Lật Cặp Môi" lip-photo memory game (umpah1.js, Logic2.Umpah1Session); the v2.2 ring game is in assets/_archive/
    umpah: { name: 'Um-Pah! 1', title: 'Um-Pah!', num: 1, world: 'pink', product: 'Nu Blur Tint', prefix: 'U', thanks: TH_NB, bgm: 'umpah', bar: 'UM-PAH-1.EXE', story: 'rd-up', max: 1500,
      session: function (seed) { return new Logic2.Umpah1Session(seed, { difficulty: lvl('umpah') }); }, module: function () { return window.Umpah1Game; },
      start: function (S) { Umpah1Game.start(S, endGame, App.home); } },
    umpah2: { name: 'Um-Pah! 2', title: 'Um-Pah!', num: 2, world: 'pink', product: 'Nu Blur Tint', prefix: 'U2', thanks: TH_NB, bgm: 'umpah2', bar: 'UM-PAH-2.EXE', story: 'rd-kk', max: 1500,
      session: function (seed) { return new Logic2.Umpah2Session(seed, { difficulty: lvl('umpah2') }); }, module: function () { return window.Umpah2Game; },
      start: function (S) { Umpah2Game.start(S, endGame, App.home); } },
    taptap: { name: 'Tap-Tap! 1', title: 'Tap-Tap!', num: 1, world: 'lilac', product: 'Radiance Balm', prefix: 'T', thanks: TH_RB, bgm: 'taptap', bar: 'TAP-TAP-1.EXE', story: 'rd-tt', max: tilesMaxAvg('normal'), maxBy: { easy: tilesMaxAvg('easy'), normal: tilesMaxAvg('normal'), hard: tilesMaxAvg('hard') }, // maxBy: Control Center ≈ points
      session: function (seed) { return new Logic.TilesSession(seed, { difficulty: lvl('taptap') }); }, module: function () { return window.TaptapGame; },
      start: function (S) { TaptapGame.start(S, { latencyMs: App.settings.latencyMs }, endGame); } },
    taptap2: { name: 'Tap-Tap! 2', title: 'Tap-Tap!', num: 2, world: 'lilac', product: 'Radiance Balm', prefix: 'T2', thanks: TH_RB, bgm: 'taptap2', bar: 'TAP-TAP-2.EXE', story: 'rd-gg', max: 1400,
      session: function (seed) { return new Logic2.Taptap2Session(seed, { latencyMs: App.settings.latencyMs, difficulty: lvl('taptap2') }); }, module: function () { return window.Taptap2Game; },
      start: function (S) { Taptap2Game.start(S, endGame); } } // latency: the session applies it in drop()
  };
  var GAME_ORDER = ['umpah', 'umpah2', 'taptap', 'taptap2'];
  App.GAME = GAME; App.GAME_ORDER = GAME_ORDER;
  function lilac(g) { return !!GAME[g] && GAME[g].world === 'lilac'; }
  // selectable = switched on in Admin (settings.games) AND its module is loaded
  App.selectable = function (k) { return !!(GAME[k] && App.settings.games[k] && GAME[k].module()); };
  function eachModule(fn) { GAME_ORDER.forEach(function (k) { var m = GAME[k].module(); if (m) fn(m); }); }

  // ---------------- utils ----------------
  function later(fn, ms) { var id = setTimeout(function () { try { fn(); } catch (e) { onError(e); } }, ms); App.timers.push(id); return id; }
  function clearTimers() { App.timers.forEach(clearTimeout); App.timers = []; }
  function overlay(id, on) { $(id).classList.toggle('active', !!on); }
  function isoLocal(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; }, off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-'; off = Math.abs(off);
    return Logic.localDate(d) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + s + p(Math.floor(off / 60)) + ':' + p(off % 60);
  }
  function needPts(game, max, tier) { return Math.ceil(App.settings.thresholds[game]['tier' + tier] * max / 100); }
  function tierOf(game, score, max) { return score >= needPts(game, max, 2) ? 2 : score >= needPts(game, max, 1) ? 1 : 0; }
  App.needPts = needPts;
  // shrink el's font-size from max px until the text fits its box width (and maxH px height when given); el must be visible
  function fitFont(el, max, maxH) {
    var fs = max; el.style.fontSize = fs + 'px';
    while (fs > 24 && (el.scrollWidth > el.clientWidth + 1 || (maxH && el.scrollHeight > maxH))) { fs -= 2; el.style.fontSize = fs + 'px'; }
  }
  // v2.4: settings with an English twin (<key>En); an empty EN value falls back to the Vietnamese one
  function txt(k) { var s = App.settings; return (en() && s[k + 'En']) || s[k]; }
  function giftName(n) { var s = App.settings, e = en() && s.giftsEn && s.giftsEn['tier' + n]; return e || s.gifts['tier' + n]; }
  // phone: VN format exactly as before, or international '+' followed by 8–15 digits; duplicates compare digits only with +84 → 0
  function validPhoneAny(p) { return Logic.validPhone(p) || /^\+\d{8,15}$/.test(p); }
  function normPhone(p) { p = String(p || ''); var d = p.replace(/\D/g, ''); return p.slice(0, 3) === '+84' ? '0' + d.slice(2).replace(/^0+/, '') : d; } // +840901… = 0901…
  var TRI = '<svg class="tri" viewBox="0 0 10 12"><path d="M0 0h2v1h2v1h2v1h2v1h2v4H8v1H6v1H4v1H2v1H0z"/></svg>';

  function fit() {
    var s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = 'scale(' + s + ')';
  }

  App.applySettings = function () {
    App.settings = Store.settings();
    if (App.settings.idleSec.thanks === 8) App.settings.idleSec.thanks = 12; // v2.1: stale pre-v2.1 default from an Admin save (Admin cannot edit idleSec)
    Sfx.setEnabled(App.settings.sound); Sfx.setVolume(App.settings.volume);
    Sfx.setBgmEnabled(App.settings.bgm); Sfx.setBgmVolume(App.settings.bgmVolume);
    $('test-badge').classList.toggle('on', !!App.settings.testMode);
  };

  // ---------------- screens ----------------
  // background music per screen (Music crossfades 600 ms, same track keeps playing); a screen not listed (promo, item 6) pauses it
  var BGM = { attract: 'lobby', select: 'lobby', intro: 'lobby', ready: 'lobby', result: 'lobby', form: 'lobby', reward: 'lobby', thanks: 'lobby' };
  GAME_ORDER.forEach(function (k) { BGM[k] = GAME[k].bgm; }); // game screen id = game key
  function show(name) {
    if (name === 'select') name = 'attract'; // v2.6: SELECT merged into the ATTRACT ticket tabs
    var prev = App.screen, cur = document.querySelector('.screen.active');
    if (cur) cur.classList.remove('active');
    if (name === 'attract') layoutSelect();
    $('s-' + name).classList.add('active');
    App.screen = name; App.lastAct = performance.now(); App.shownAt = performance.now();
    var scr = $('s-' + name); requestAnimationFrame(function () { if (App.screen === name) I18N.fitIn(scr); }); // v2.4: longer English lines shrink to fit
    hideIdle();
    if (BGM[name]) Music.play(BGM[name]); else Music.pause();
    if (name === 'attract') attractVideo(true);
    else { try { $('attract-video').pause(); } catch (e) { } }
    if (prev === 'intro' && name !== 'intro') introStop(); // v2.4: never keep decoding the intro in the background
    var pv = $('promo-video');
    if (name === 'promo') playPromo(pv);
    else if (prev === 'promo') { try { pv.pause(); pv.currentTime = 0; } catch (e) { } }
  }
  // PROMO (v2.1 item 6): sound on; if the browser blocks autoplay with sound, play muted. BGM is paused by show() (promo has no BGM entry)
  function playPromo(pv) {
    pv.muted = false;
    var p = pv.play();
    if (p && p.catch) p.catch(function () {
      if (App.screen !== 'promo') return; // rejected because we already left (pause() aborts play())
      pv.muted = true; var q = pv.play(); if (q && q.catch) q.catch(function () { });
    });
  }

  App.home = function () {
    if (App.homing) return; App.homing = true;
    try {
      clearTimers(); resetHold(); Sfx.stopAll();
      eachModule(function (m) { m.stop(); });
      ['o-idle', 'o-policy'].forEach(function (id) { overlay(id, false); });
      App.session = null; App.result = null; App.game = '';
      // periodic reload while idle keeps memory fresh on long days
      if ((performance.now() - App.bootAt) > App.settings.autoReloadHours * 3600e3 && !$('o-admin').classList.contains('active')) { location.reload(); return; }
      I18N.set(App.settings.defaultLang || 'vi'); // v2.4: the language chosen on ATTRACT holds for one customer
      show('attract');
    } finally { App.homing = false; }
  };

  // ATTRACT ticket tabs (v2.6, was SELECT): only selectable games, in GAME_ORDER; the flex row shares the width (4/3/2/1)
  function layoutSelect() {
    var list = GAME_ORDER.filter(App.selectable);
    if (!list.length) list = GAME_ORDER.filter(function (k) { return GAME[k].module(); }); // never an empty row (bad injected settings)
    [].forEach.call(document.querySelectorAll('#s-attract .game-card'), function (c) { c.style.display = list.indexOf(c.getAttribute('data-game')) < 0 ? 'none' : ''; });
  }
  // attract video: the first tap shows the flyer (.peek, never starts a game); idle on the flyer (idleSec.select) → the video again
  function attractVideo(on) {
    var s = $('s-attract'), v = $('attract-video');
    s.classList.toggle('peek', !on);
    if (on && s.classList.contains('has-video')) { try { v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
    else { try { v.pause(); } catch (e) { } }
  }

  // READY: icon story + 3·2·1 + title flash, then auto-start. Timers go through later() (App.home cancels them)
  // and are also kept in readyTimers so startGame() can drop them (debug startGame during READY never double-starts).
  var readyTimers = [], readyFlashed = false;
  function readyLater(fn, ms) { readyTimers.push(later(fn, ms)); }
  function clearReady() { readyTimers.forEach(clearTimeout); readyTimers = []; }
  // title + number badge, centred; shrunk by a static inner scale() when wider than 960 px. el must be visible (measures)
  function readyPair(el, G) {
    var tap = G.world === 'lilac';
    el.innerHTML = '<span class="rd-pair"><span class="ttl ' + (tap ? 'lil' : 'pink') + '">' + G.title + '</span><span class="lvl' + (tap ? ' lil' : '') + '">' + G.num + '</span></span>';
    var p = el.firstChild, w = p.offsetWidth, max = Math.min(960, (el.clientWidth || 960) - 60); // v2.6: fits its paper (notebook / strip)
    if (w > max) p.style.transform = 'scale(' + (max / w).toFixed(3) + ')';
  }
  // txt = 3·2·1 digit; flash = title + number badge
  function readyShow(txt, flash) {
    if (App.screen !== 'ready') return false;
    var n = $('ready-count'), tap = lilac(App.game);
    n.className = 'abs center ttl rd-count' + (flash ? ' flash ' + (tap ? 'lil' : 'pink') : tap ? ' lil' : '');
    if (flash) readyPair(n, GAME[App.game]); else n.textContent = txt;
    void n.offsetWidth; n.classList.add('fx-pop'); // restart v2pop
    return true;
  }
  function readyFlash() { if (readyShow('', true)) { readyFlashed = true; Sfx.play('go'); } }
  function readyGo() { if (App.screen === 'ready') startGame(); }

  // returns false (does nothing) for an unknown key or a game whose module is not loaded
  function toReady(game) {
    var G = GAME[game]; if (!G || !G.module()) return false;
    clearReady();
    App.game = game;
    var seed = (Math.random() * 2147483647) | 0;
    App.session = G.session(seed);
    var tap = lilac(game), s = $('s-ready');
    s.setAttribute('data-game', game); s.setAttribute('data-story', G.story); s.classList.toggle('lilac', tap);
    $('ready-win').classList.toggle('lil', tap);
    $('ready-count').textContent = ''; readyFlashed = false;
    $('ready-prod').textContent = G.product;
    show('ready');
    readyPair($('ready-title'), G);
    ['3', '2', '1'].forEach(function (txt, i) { readyLater(function () { if (readyShow(txt, false)) Sfx.play('count'); }, i * 800); });
    readyLater(readyFlash, 2400);
    readyLater(readyGo, 3200);
    return true;
  }


  // ---------------- INTRO (v2.4 A): 3D product reveal, SELECT card → video → READY ----------------
  // Two <video>s are preloaded at boot. WebM (VP9 alpha) only on Chromium, else the MP4 with the screen background baked in.
  // ended → hold 250 ms → 120 ms white flash → toReady; tap (≥ 400 ms) skips to the flash; no 'playing' within 1200 ms,
  // error or stalled → end PNG pops in, 1200 ms, READY; hard cap 4.5 s. Timers go through later() (App.home cancels them).
  var INTRO = { nb: { file: 'reveal_nublur', bake: '_toffee', chip: 'NU BLUR TINT', beat: 1550 }, rb: { file: 'reveal_balm', bake: '_toffee', chip: 'RADIANCE BALM', beat: 750 } };
  var intro = { game: '', k: '', v: null, done: true, started: false, fb: false };
  function introSrc(k) {
    var I = INTRO[k], v = $('intro-' + k), webm = false;
    try { webm = v.canPlayType('video/webm; codecs="vp9"') !== '' && /Chrome|Chromium|CriOS|Edg/.test(navigator.userAgent); } catch (e) { }
    return 'assets/video/reveal/' + I.file + (webm ? '.webm' : I.bake + '.mp4');
  }
  function introInit() {
    ['nb', 'rb'].forEach(function (k) {
      var v = $('intro-' + k);
      v.muted = true;
      v.addEventListener('playing', function () { if (intro.v !== v || intro.done || intro.started) return; intro.started = true; later(function () { if (intro.v === v && !intro.done) Sfx.play('peek'); }, INTRO[k].beat); });
      v.addEventListener('ended', function () { if (intro.v === v && !intro.done && !intro.fb) later(introGo, 250); });
      ['error', 'stalled'].forEach(function (ev) { v.addEventListener(ev, function () { if (intro.v === v && !intro.done) introFallback(); }); });
      v.src = introSrc(k); try { v.load(); } catch (e) { }
    });
    $('s-intro').addEventListener('pointerdown', function () {
      if (App.screen === 'intro' && performance.now() - (App.shownAt || 0) >= 400) introGo();
    });
  }
  function introStop() {
    ['nb', 'rb'].forEach(function (k) { var v = $('intro-' + k); try { v.pause(); v.currentTime = 0; } catch (e) { } });
    intro.v = null; intro.done = true; $('intro-flash').classList.remove('on');
  }
  // returns false for an unknown key or a game whose module is not loaded (like toReady)
  function toIntro(game) {
    var G = GAME[game]; if (!G || !G.module()) return false;
    if (App.settings.productIntro === false) return toReady(game); // Control Center: Intro sản phẩm 3D TẮT
    var k = lilac(game) ? 'rb' : 'nb', s = $('s-intro'), v = $('intro-' + k);
    introStop();
    App.game = game;
    intro = { game: game, k: k, v: v, done: false, started: false, fb: false };
    s.classList.toggle('lilac', k === 'rb'); s.setAttribute('data-v', k);
    $('intro-chip').textContent = INTRO[k].chip;
    $('intro-end').src = 'assets/video/reveal/' + INTRO[k].file + '_end.png';
    show('intro');
    readyPair($('intro-title'), G);
    try { v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function () { if (intro.v === v && !intro.done) introFallback(); }); } catch (e) { introFallback(); }
    later(function () { if (intro.v === v && !intro.done && !intro.started) introFallback(); }, 1200);
    later(function () { if (intro.v === v && !intro.done) introGo(); }, 4500); // hard cap
    return true;
  }
  function introFallback() {
    if (intro.fb || intro.done) return; intro.fb = true;
    try { intro.v.pause(); } catch (e) { }
    $('s-intro').setAttribute('data-v', 'end'); Sfx.play('peek');
    var v = intro.v; later(function () { if (intro.v === v && !intro.done) introGo(); }, 1200);
  }
  function introGo() {
    if (intro.done || App.screen !== 'intro') return; intro.done = true;
    var game = intro.game;
    $('intro-flash').classList.add('on');
    later(function () { if (App.screen === 'intro' && App.game === game) toReady(game); }, 120);
  }

  function startGame() {
    clearReady();
    var game = App.game; if (!game || !App.session) return App.home();
    show(game);
    GAME[game].start(App.session);
  }

  function endGame(S) {
    var max = S.max, score = Math.min(S.score, S.max), tier = tierOf(App.game, score, max);
    App.result = { game: App.game, score: score, max: max, pct: Logic.pct(score, max), tierByScore: tier, seed: S.seed, difficulty: S.difficulty };
    later(showResult, 600);
  }

  // RESULT: title + labels by tier, score count-up (1.2 s ease-out), 14-cell bar, gift/crown under the tier thresholds
  function num(n) { return n.toLocaleString(en() ? 'en-US' : 'vi-VN'); } // v2.6: 1.200 (VI) / 1,200 (EN)
  function showResult() {
    var r = App.result, g = App.game, t = r.tierByScore, dur = 1200;
    var n1 = needPts(g, r.max, 1), n2 = needPts(g, r.max, 2), fin = num(r.score);
    $('s-result').setAttribute('data-tier', t);
    $('res-title').innerHTML = t ? 'LEVEL ' + t + '<br>CLEAR!' : 'SO<br>CLOSE!';
    $('res-eb').textContent = T('result.eyebrow', { game: GAME[g].name.toUpperCase() });
    $('res-of').textContent = T('result.of', { max: num(r.max) });
    $('res-tier').textContent = T('result.level', { n: t });
    $('res-need').textContent = T('result.need', { n: Math.max(0, n1 - r.score).toLocaleString(en() ? 'en-US' : 'vi-VN') });
    $('res-ico1').style.left = (100 * Math.min(1, n1 / r.max)).toFixed(2) + '%'; $('res-ml1').textContent = T('result.tier', { n: 1 }); // v2.6 cocoa ticks on the meter
    $('res-ico2').style.left = (100 * Math.min(1, n2 / r.max)).toFixed(2) + '%'; $('res-ml2').textContent = T('result.tier', { n: 2 });
    // cell i lights when the count-up passes (i + .5) / 14 of max (inverse of the ease-out below)
    var cells = $('res-seg').children, lit = Math.round(14 * Math.min(1, r.score / r.max));
    for (var i = 0; i < cells.length; i++) {
      cells[i].className = i < lit ? 'on' : '';
      cells[i].style.setProperty('--d', Math.round(dur * (1 - Math.pow(Math.max(0, 1 - (i + 0.5) * r.max / 14 / r.score), 1 / 3))) + 'ms');
    }
    var next = $('res-next'), skip = $('res-skip'), form = t > 0 || App.settings.requireFormForNoTier;
    next.firstChild.textContent = T(t ? 'result.claim' : 'result.save');
    next.style.display = form ? '' : 'none'; skip.style.display = form ? 'none' : '';
    var el = $('res-score');
    el.style.fontSize = (fin.length <= 5 ? 250 : Math.floor(250 * 5 / fin.length * 0.95)) + 'px'; // final string fits the sheet
    el.textContent = '0';
    show('result');
    var t0 = performance.now(), shown = '0';
    (function step(now) {
      if (App.screen !== 'result') return;
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), txt = num(Math.round(r.score * e));
      if (txt !== shown) { el.textContent = shown = txt; Sfx.play('count_tick'); } // Sfx rate-limits ticks to 60 ms
      if (k < 1) requestAnimationFrame(step);
      else Sfx.play(t === 2 ? 'win_t2' : t ? 'win_t1' : 'no_tier');
    })(t0);
  }

  // ---------------- form ----------------
  var NAME_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  function renderKb() {
    var f = App.form, h = '';
    function key(k, cls, lbl) { return '<button class="key' + (cls ? ' ' + cls : '') + '" data-k="' + k + '">' + (lbl || k) + '</button>'; }
    if (f.focus === 'name') {
      NAME_ROWS.forEach(function (row) { h += '<div class="kb-row">' + row.split('').map(function (c) { return key(c); }).join('') + '</div>'; });
      h += '<div class="kb-row b">' + key('DEL', 'wide', T('form.del')) + key(' ', 'space', 'SPACE') + key('NEXT', 'wide btn vn', '<span>' + T('common.next') + '</span>' + TRI) + '</div>';
    } else {
      // v2.4 EN: the (no-op) done key becomes '+' for international numbers; the VI keyboard is unchanged
      [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['DEL', '0', en() ? '+' : 'OK']].forEach(function (row) {
        h += '<div class="kb-row">' + row.map(function (c) { return c === 'DEL' ? key(c, 'num wide', T('form.del')) : c === 'OK' ? key(c, 'num wide btn vn', T('form.done')) : c === '+' ? key(c, 'num wide') : key(c, 'num'); }).join('') + '</div>';
      });
    }
    $('kb').innerHTML = h; $('kb').classList.toggle('num', f.focus !== 'name');
  }
  function renderForm() {
    var f = App.form;
    $('f-name-val').textContent = f.name;
    $('f-phone-val').textContent = f.phone.charAt(0) === '+' ? f.phone : Logic.formatPhone(f.phone);
    $('f-name').classList.toggle('focus', f.focus === 'name');
    $('f-phone').classList.toggle('focus', f.focus === 'phone');
    fitFont($('f-name-val'), 66); fitFont($('f-phone-val'), 66);
    document.querySelector('[data-consent="gift"]').classList.toggle('on', f.cg);
    document.querySelector('[data-consent="mkt"]').classList.toggle('on', f.cm);
  }
  function toForm() {
    App.form = { name: '', phone: '', focus: 'name', cg: false, cm: false };
    $('c-gift').textContent = txt('consentGiftText'); $('c-mkt').textContent = txt('consentMarketingText');
    $('form-err').textContent = ''; $('f-name').classList.remove('bad'); $('f-phone').classList.remove('bad');
    $('form-submit').disabled = false;
    $('fm-eb').textContent = App.result && App.result.tierByScore ? T('result.tier', { n: App.result.tierByScore }) : ''; // v2.6 eyebrow
    renderKb(); renderForm(); show('form');
  }
  function onKey(k) {
    var f = App.form; Sfx.play('key'); $('form-err').textContent = '';
    if (f.focus === 'name') {
      if (k === 'DEL') f.name = f.name.slice(0, -1);
      else if (k === 'NEXT') { f.focus = 'phone'; renderKb(); }
      else if (k === ' ') { if (f.name.length && f.name.slice(-1) !== ' ' && f.name.length < 40) f.name += ' '; }
      else if (f.name.length < 40) f.name += k;
      $('f-name').classList.remove('bad');
    } else {
      if (k === 'DEL') f.phone = f.phone.slice(0, -1);
      else if (k === 'OK') { /* nothing, user taps submit */ }
      else if (k === '+') { if (!f.phone) f.phone = '+'; } // international: '+' first only
      else if (f.phone.length < (f.phone.charAt(0) === '+' ? 16 : 10)) f.phone += k;
      $('f-phone').classList.remove('bad');
    }
    renderForm();
  }
  function submitForm() {
    var f = App.form, s = App.settings, err = '', btn = $('form-submit');
    if (btn.disabled) return;
    var name = Logic.cleanName(f.name);
    function shake(id) { var el = $(id); el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad'); } // restart upShake on every failed submit
    if (!Logic.validName(name)) { err = T('form.err.name'); shake('f-name'); }
    else if (!validPhoneAny(f.phone)) { err = T('form.err.phone'); shake('f-phone'); }
    else if (!f.cg) err = T('form.err.consent');
    if (err) { $('form-err').textContent = err; Sfx.play('miss'); return; }
    btn.disabled = true;
    Sfx.play('submit');

    var r = App.result, today = Logic.localDate(), records = Store.records();
    // v2.4: duplicate check on a normalised number (digits only, +84 → 0) so +84 90… and 090… are the same customer
    var norm = records.map(function (x) { return { testMode: x.testMode, phone: normPhone(x.phone), tier: x.tier, date: x.date }; });
    var res = Logic.resolveReward(r.tierByScore, { phone: normPhone(f.phone), records: norm, rule: s.duplicateRule, today: today, stock: s.testMode ? { tier1: 1, tier2: 1 } : Store.stock() });
    var rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      createdAt: isoLocal(new Date()), date: today, game: r.game, score: r.score, maxScore: r.max, scorePct: r.pct,
      tierByScore: r.tierByScore, tier: res.tier, reason: res.reason,
      giftName: res.tier ? giftName(res.tier) : '', rewardCode: res.tier ? Store.nextCode(GAME[r.game].prefix) : '',
      name: name, phone: f.phone, consentGift: true, consentMarketing: !!f.cm, consentTextVersion: en() ? 'v1-en' : 'v1',
      redeemed: false, redeemedAt: '', testMode: !!s.testMode, seed: r.seed, appVersion: s.appVersion,
      difficulty: r.difficulty || 'normal', kiosk: s.kioskName || '', // v2.3
      lang: I18N.lang // v2.4
    };
    var saved = true;
    try { Store.addRecord(rec); if (rec.tier && !rec.testMode) Store.takeStock(rec.tier); }
    catch (e) { saved = false; Store.log('save failed ' + e.message); }
    if (saved && window.Sheet) Sheet.enqueue(rec.id); // v2.3: background Google Sheet sync (test-mode records are skipped there)
    App.record = rec;
    if (rec.tier === 0 && rec.reason === '') return toThanks(name);
    toReward(rec, saved);
  }

  // ---------------- reward ----------------
  // tier > 0: gift + code + staff hold (downgraded adds a note); tier 0 (duplicate / out of stock): #s-reward.t0 = greyed gift, note, HOÀN TẤT
  function toReward(rec, saved) {
    var t0 = !rec.tier, dup = rec.reason === 'duplicate';
    $('s-reward').classList.toggle('t0', t0);
    $('rw-eyebrow').textContent = T(t0 ? 'thanks.title' : 'reward.hi');
    $('rw-name').textContent = rec.name + '!';
    $('rw-tier').textContent = t0 ? '—' : T('result.tier', { n: rec.tier });
    // v2.6 receipt rows: game · score / max · gift level · time (from the record's createdAt, local)
    var G = GAME[rec.game], ts = String(rec.createdAt || '');
    $('rw-r-game').textContent = G ? G.name.toUpperCase() : '';
    $('rw-r-score').textContent = num(rec.score || 0) + ' / ' + num(rec.maxScore || 0);
    $('rw-r-time').textContent = ts.length >= 16 ? ts.slice(8, 10) + '/' + ts.slice(5, 7) + '/' + ts.slice(0, 4) + ' · ' + ts.slice(11, 16) : '';
    $('rw-gift').textContent = t0 ? T(dup ? 'reward.done' : 'result.soldOut') : rec.giftName;
    $('rw-code').textContent = rec.rewardCode;
    barcode($('rw-bc'), t0 ? '' : String(rec.rewardCode || ''));
    $('rw-note').textContent = t0 ? T(dup ? 'form.onePerPhone' : 'reward.tomorrow') : rec.reason === 'downgraded' ? T('reward.downgrade') : '';
    $('rw-msg').textContent = !saved ? T('form.err.save') : t0 ? '' : T('reward.show');
    resetHold();
    show('reward');
    fitFont($('rw-name'), 128); fitFont($('rw-gift'), 64); fitFont($('rw-code'), 104);
    if (!t0) Sfx.play('win_t' + rec.tier);
  }
  // v2.6 P2: Code 128-B barcode of the gift code as inline SVG bars (no library). C128[v] = bar/space module widths of value v
  // (103–105 start A/B/C, 106 stop); checksum = (104 + Σ i·v_i) mod 103. tests/app_tests/v26_check.py decodes the bars back.
  var C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
  function barcode(svg, text) {
    var v = [104], sum = 104, x = 10, h = '', i, j, c, p;
    for (i = 0; i < text.length; i++) { c = text.charCodeAt(i) - 32; if (c < 0 || c > 94) text = ''; v.push(c); sum += c * (i + 1); }
    if (!text) { svg.innerHTML = ''; return; } // nothing to encode: no barcode (never a fake one)
    v.push(sum % 103, 106);
    for (i = 0; i < v.length; i++) for (p = C128[v[i]], j = 0; j < p.length; j++) { if (!(j % 2)) h += '<rect x="' + x + '" width="' + p[j] + '" height="1"/>'; x += +p[j]; }
    svg.setAttribute('viewBox', '0 0 ' + (x + 10) + ' 1'); svg.innerHTML = h;
  }
  var holdT0 = 0, holdRaf = 0, holding = false;
  function resetHold() { holding = false; cancelAnimationFrame(holdRaf); $('rw-hold-fill').style.transform = 'scaleX(0)'; $('rw-hold').style.setProperty('--k', 0); }
  function holdStep(now) {
    if (!holding || App.screen !== 'reward') { holding = false; return; }
    var k = Math.min(1, (now - holdT0) / 2000);
    $('rw-hold-fill').style.transform = 'scaleX(' + k + ')'; $('rw-hold').style.setProperty('--k', k.toFixed(3)); // v2.6 progress ring
    if (k >= 1) {
      holding = false;
      var rec = App.record;
      if (rec && Store.updateRecord(rec.id, { redeemed: true, redeemedAt: isoLocal(new Date()) }) && window.Sheet) Sheet.enqueue(rec.id); // upsert
      Sfx.play('staff_ok');
      toThanks(rec ? rec.name : '');
      return;
    }
    holdRaf = requestAnimationFrame(holdStep);
  }

  // THANKS: last word of the name, the played product's photo, one line per game
  function toThanks(name) {
    var g = GAME[App.game] ? App.game : 'umpah', w = String(name || '').trim().split(/\s+/).pop();
    // v2.6 postcard: "Cảm ơn" / italic "Name!" (own line), the played product's photo in the polaroid
    $('th-hi').style.display = w ? '' : 'none';
    $('th-title').textContent = w ? w + '!' : T('thanks.title');
    $('th-lips').src = ASSETS.v26('photos/thanks_' + (lilac(g) ? 'rb' : 'nb') + '.jpg');
    $('th-prod').textContent = GAME[g].product;
    $('th-sub').textContent = T(GAME[g].thanks);
    $('th-count').textContent = T('thanks.back', { s: App.settings.idleSec.thanks });
    show('thanks');
    fitFont($('th-title'), 170);
  }

  // ---------------- idle ----------------
  function hideIdle() { App.idleWarn = false; overlay('o-idle', false); }
  function idleTick() {
    if ($('o-admin').classList.contains('active')) return;
    if (App.screen === 'attract') { // v2.6: flyer shown over the attract video → back to the video after idleSec.select
      var a = $('s-attract');
      if (a.classList.contains('peek') && a.classList.contains('has-video') && (performance.now() - App.lastAct) / 1000 > App.settings.idleSec.select) App.home(); // video again + default language
      return;
    }
    var lim = App.settings.idleSec[App.screen];
    if (!lim) return; // games: no idle
    var el = (performance.now() - App.lastAct) / 1000;
    // THANKS: no warning overlay; #th-count shows the real seconds left (lim → 1), any touch restarts it
    if (App.screen === 'thanks') { if (el > lim) App.home(); else $('th-count').textContent = T('thanks.back', { s: Math.max(1, Math.ceil(lim - el)) }); return; }
    if (!App.idleWarn && el > lim) { App.idleWarn = true; App.idleLeft = App.settings.idleSec.warn; overlay('o-idle', true); $('idle-sec').textContent = App.idleLeft; }
    else if (App.idleWarn) {
      App.idleLeft = Math.max(0, App.settings.idleSec.warn - Math.floor(el - lim));
      $('idle-sec').textContent = App.idleLeft;
      if (App.idleLeft <= 0) App.home();
    }
  }

  // ---------------- errors ----------------
  var lastErrHome = 0;
  function onError(e) {
    try { Store.log('ERROR ' + (e && (e.stack || e.message || e.reason || e))); } catch (x) { }
    if ($('o-admin').classList.contains('active')) return;
    var now = performance.now();
    if (now - lastErrHome > 3000) { lastErrHome = now; try { App.home(); } catch (x) { } }
  }
  window.addEventListener('error', function (ev) { onError(ev.error || ev.message); });
  window.addEventListener('unhandledrejection', function (ev) { onError(ev.reason); });

  // ---------------- kiosk hardening ----------------
  function allowScroll(t) { return t && t.closest && !!t.closest('.admin-panel'); } // v2.3 Control Center scroll container (#admin-panel)
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { if (!(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { if (!allowScroll(e.target) || e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if ($('o-admin').classList.contains('active')) return;
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R' || e.key === '+' || e.key === '-' || e.key === '='))) e.preventDefault();
  });
  var wakeLock = null;
  function keepAwake() {
    try { if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () { }); } catch (e) { }
  }
  function goFullscreen() {
    try { var d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(function () { }); } catch (e) { }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (GAME[App.screen] || App.screen === 'ready' || App.screen === 'intro') App.home(); }
    else keepAwake();
  });

  // ---------------- input wiring ----------------
  document.addEventListener('pointerdown', function () { App.lastAct = performance.now(); if (App.idleWarn) hideIdle(); }, true);

  $('s-attract').addEventListener('pointerdown', function () {
    if (!App.assetsReady) return; // images still preloading (max 8 s)
    Sfx.unlock(); goFullscreen(); keepAwake();
    var s = $('s-attract');
    if (s.classList.contains('has-video') && !s.classList.contains('peek')) { Sfx.play('start'); attractVideo(false); App.shownAt = performance.now(); } // the same touch's click never picks a ticket
  });
  stage.addEventListener('click', function (e) {
    // ignore the "ghost" click that belongs to the touch which opened this screen
    if (performance.now() - (App.shownAt || 0) < 450 && !e.target.closest('.overlay')) return;
    var card = e.target.closest('.game-card'); if (card && App.screen === 'attract') { if (App.assetsReady) { Sfx.play('select'); toIntro(card.getAttribute('data-game')); } return; }
    var c = e.target.closest('.consent'); if (c && App.screen === 'form') { var k = c.getAttribute('data-consent') === 'gift' ? 'cg' : 'cm'; App.form[k] = !App.form[k]; $('form-err').textContent = ''; Sfx.play('key'); renderForm(); return; }
    var fld = e.target.closest('.field'); if (fld && App.screen === 'form') { App.form.focus = fld.getAttribute('data-field'); renderKb(); renderForm(); return; }
    var b = e.target.closest('[data-action]'); if (!b) return;
    var a = b.getAttribute('data-action');
    switch (a) {
      case 'home': App.home(); break;
      case 'form': if (App.screen === 'result') toForm(); break;
      case 'thanks-skip': if (App.screen === 'result') toThanks(''); break;
      case 'thanks': if (App.screen === 'reward') toThanks(App.record ? App.record.name : ''); break;
      case 'idle-stay': hideIdle(); break;
      case 'policy': $('policy-text').textContent = txt('policyText'); overlay('o-policy', true); break;
      case 'policy-close': overlay('o-policy', false); break;
    }
    Sfx.play('ui_tap'); // after the action: App.home() cuts every sound still ringing
  });
  // READY: a tap >= 450 ms after show jumps to the title flash and starts 800 ms later; later taps are ignored
  $('s-ready').addEventListener('pointerdown', function () {
    if (App.screen !== 'ready' || readyFlashed || performance.now() - (App.shownAt || 0) < 450) return;
    clearReady(); readyFlash(); readyLater(readyGo, 800);
  });
  $('kb').addEventListener('pointerdown', function (e) {
    var k = e.target.closest('.key'); if (!k) return;
    e.preventDefault(); k.classList.add('down'); setTimeout(function () { k.classList.remove('down'); }, 110);
    onKey(k.getAttribute('data-k'));
  });
  $('form-submit').addEventListener('click', function () { if (performance.now() - (App.shownAt || 0) >= 450) submitForm(); });

  var hb = $('rw-hold');
  hb.addEventListener('pointerdown', function (e) { if (App.screen !== 'reward') return; holding = true; holdT0 = performance.now(); try { hb.setPointerCapture(e.pointerId); } catch (x) { } holdRaf = requestAnimationFrame(holdStep); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { hb.addEventListener(ev, function () { if (holding) resetHold(); }); });

  // v2.3 C1: ATTRACT staff corners; neither pointerdown (#s-attract → SELECT) nor click (stage) may leave the button
  function corner(id, fn) {
    var el = $(id);
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); });
    el.addEventListener('click', function (e) { e.stopPropagation(); if (App.screen === 'attract' && !$('o-admin').classList.contains('active')) fn(); }); // keyboard can reach them under the CC
  }
  corner('cc-btn', function () { Admin.open(); }); // ⚙ top-left → PIN pad → Control Center
  // v2.4 C1: VI | EN next to ⚙ (ATTRACT only); same propagation guard as the corners
  (function () {
    var sw = $('lang-sw');
    sw.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); });
    sw.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('[data-lang]'); if (!b || App.screen !== 'attract' || $('o-admin').classList.contains('active')) return;
      Sfx.unlock(); Sfx.play('key'); I18N.set(b.getAttribute('data-lang'));
    });
    document.addEventListener('langchange', function () {
      [].forEach.call(sw.children, function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === I18N.lang); });
      if ($('o-admin').classList.contains('active')) Admin.render();
      if (App.screen) I18N.fitIn($('s-' + App.screen));
    });
  })();
  corner('promo-btn', function () { // ▶ VIDEO top-right
    if (!App.promoReady) return;
    show('promo'); Sfx.unlock(); keepAwake(); // unlock after show: Music stays paused until we leave promo
  });

  // admin hotspot: hold 3s (backup way in; CSS hides it on ATTRACT where ⚙ takes the corner)
  var hs = $('admin-hotspot'), hsTimer = 0;
  hs.addEventListener('pointerdown', function (e) { e.stopPropagation(); clearTimeout(hsTimer); if (App.screen === 'intro') return; hsTimer = setTimeout(function () { if (App.screen !== 'intro') Admin.open(); }, 3000); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { hs.addEventListener(ev, function () { clearTimeout(hsTimer); }); });

  // ---------------- boot ----------------
  function boot() {
    App.applySettings();
    Sfx.probe(); // optional assets/audio/<key>.mp3|wav|ogg overrides
    ASSETS.preload(function () { App.assetsReady = true; });
    try { ['500 40px "Noto Serif Display Variable"', 'italic 500 40px "Noto Serif Display Variable"', '500 40px "Be Vietnam Pro"', '600 40px "Be Vietnam Pro"', '600 40px "IBM Plex Mono"', '600 40px VNfix'].forEach(function (f) { document.fonts.load(f).catch(function () { }); }); } catch (e) { }
    fit(); window.addEventListener('resize', fit);
    eachModule(function (m) { m.init(); }); Admin.init(); introInit();
    var v = $('attract-video');
    v.addEventListener('canplay', function () { $('s-attract').classList.add('has-video'); if (App.screen === 'attract' && !$('s-attract').classList.contains('peek')) { var p = v.play(); if (p && p.catch) p.catch(function () { }); } }, { once: true });
    v.addEventListener('error', function () { $('s-attract').classList.remove('has-video'); });
    v.src = 'assets/video/attract.mp4';
    var pv = $('promo-video'); // optional promo: the staff button appears only once the file loads
    pv.addEventListener('loadedmetadata', function () { App.promoReady = true; $('promo-btn').classList.add('on'); }, { once: true });
    pv.addEventListener('error', function () { App.promoReady = false; $('promo-btn').classList.remove('on'); if (App.screen === 'promo') App.home(); }); // metadata ok but data truncated/undecodable
    if (App.settings.promoVideo) pv.src = App.settings.promoVideo;
    setInterval(function () { try { idleTick(); } catch (e) { onError(e); } }, 500);
    Store.stock(); // roll daily stock
    Store.log('boot v' + App.settings.appVersion);
    I18N.set(App.settings.defaultLang || 'vi');
    show('attract');
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { } }
  }
  App.debug = { C128: C128, toHowto: toReady, toReady: toReady, toIntro: toIntro, startGame: startGame, toForm: toForm, submitForm: submitForm, show: show, endGame: endGame, toThanks: toThanks, toReward: toReward };
  boot();
})();
