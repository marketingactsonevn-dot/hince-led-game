/* hince LED Game — v2 asset lists + boot-time image preload (ES5, works from file://).
   v2.6: the 8-bit / 3D sticker / pixel tile files are retired to assets/_retired_v24/ (paper & sticker kit = assets/v26/). */
(function () {
  'use strict';
  var NB = ['01_near', '02_dear', '03_nu_allure', '04_figray', '05_hug', '06_nu_rose', '07_heart', '08_wild', '09_cold', '10_leather'];
  var NB_NAMES = ['Near', 'Dear', 'Nu Allure', 'Figray', 'Hug', 'Nu Rose', 'Heart', 'Wild', 'Cold', 'Leather'];
  var RB = ['01_clear', '02_dawn_ray', '03_tender_room', '05_light', 'gleaming', 'lil_mauve', 'shelly_pink'];
  var RB_NAMES = ['CLEAR', 'DAWN RAY', 'TENDER ROOM', 'LIGHT', 'GLEAMING', 'LIL MAUVE', 'SHELLY PINK'];
  // v2.6 paper & sticker kit (assets/v26/, design/v26_kit): textures, stickers, Tap-Tap! 1 pad, Tap-Tap! 2 claw, thanks photos; heads/ = one per RB shade
  var V26 = ['bg/bg_toffee_paper.jpg', 'paper/paper.jpg', 'paper/receipt.jpg', 'paper/tape.svg', 'paper/clip.svg', 'paper/arrow.svg',
    'stickers/p_heart.svg', 'stickers/p_lips.svg', 'stickers/p_sparkle.svg', 'stickers/p_bow.svg', 'stickers/p_gift.svg', 'stickers/p_crown.svg', 'stickers/p_star.svg',
    'tap/cap_pad.png', 'claw/claw_carriage.png', 'claw/claw_head_open.png', 'claw/claw_head_closed.png', 'photos/thanks_nb.jpg', 'photos/thanks_rb.jpg'];

  function nb(name) { return 'assets/img/products/nu_blur_tint/' + name + '.png'; }
  function rb(name) { return 'assets/img/products/radiance_balm/' + name + '.png'; }
  function v26(f) { return 'assets/v26/' + f; }
  // v2.6: square bullet close-up of Radiance Balm shade RB[i] name (168x168, bullet centred): target swatch + trays
  function head(name) { return v26('heads/head_' + name + '.png'); }
  // official Nu Blur lip swatch photo of shade NB[i] (i 0-based), 1200x960 — colour reference, never filtered
  function photo(i) { return 'assets/img/lips_photo/' + NB[i] + '.jpg'; }

  function list() {
    var out = [], i;
    for (i = 0; i < NB.length; i++) out.push(nb(NB[i]));
    for (i = 0; i < RB.length; i++) out.push(rb(RB[i]));
    for (i = 0; i < NB.length; i++) out.push(photo(i));
    for (i = 0; i < V26.length; i++) out.push(v26(V26[i]));
    for (i = 0; i < RB.length; i++) out.push(head(RB[i]));
    out.push('assets/img/logo.png');
    return out;
  }

  function log(msg) { try { if (window.Store && Store.log) Store.log(msg); } catch (e) { } }

  // Loads every image once (kept in ASSETS.cache so the browser keeps them decoded). Never throws.
  // cb fires exactly once: when all images settled (load or error) or after the 8 s safety timeout.
  function preload(cb) {
    var paths = list(), left = paths.length, done = false;
    function finish() { if (done) return; done = true; try { if (cb) cb(); } catch (e) { log('ERROR preload cb ' + e.message); } }
    function settle() { left--; if (left <= 0) finish(); }
    setTimeout(function () { if (!done) log('preload timeout, ' + left + ' left'); finish(); }, 8000);
    paths.forEach(function (p) {
      var img = new Image(), counted = false;
      function ok() { if (counted) return; counted = true; settle(); }
      function bad() { if (counted) return; counted = true; log('preload failed ' + p); settle(); }
      img.onload = function () {
        if (img.decode) { try { img.decode().then(ok, ok); return; } catch (e) { } }
        ok();
      };
      img.onerror = bad;
      api.cache[p] = img;
      img.src = p;
    });
    if (!left) finish();
  }

  var api = { NB: NB, NB_NAMES: NB_NAMES, RB: RB, RB_NAMES: RB_NAMES, cache: {}, nb: nb, rb: rb, photo: photo, v26: v26, head: head, list: list, preload: preload };
  window.ASSETS = api;
})();
