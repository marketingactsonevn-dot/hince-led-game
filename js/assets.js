/* hince LED Game — v2 asset lists + boot-time image preload (ES5, works from file://). */
(function () {
  'use strict';
  var NB = ['01_near', '02_dear', '03_nu_allure', '04_figray', '05_hug', '06_nu_rose', '07_heart', '08_wild', '09_cold', '10_leather'];
  var NB_NAMES = ['Near', 'Dear', 'Nu Allure', 'Figray', 'Hug', 'Nu Rose', 'Heart', 'Wild', 'Cold', 'Leather'];
  var RB = ['01_clear', '02_dawn_ray', '03_tender_room', '05_light', 'gleaming', 'lil_mauve', 'shelly_pink'];
  var RB_NAMES = ['CLEAR', 'DAWN RAY', 'TENDER ROOM', 'LIGHT', 'GLEAMING', 'LIL MAUVE', 'SHELLY PINK'];
  var D3 = ['star_chrome', 'star_pink', 'star_butter', 'star_lilac', 'sparkle_butter', 'sparkle_chrome', 'sparkle_pearl', 'pearl_orb', 'heart_pink'];
  var PX = ['px_hand', 'px_cursor', 'px_sparkle', 'px_sparkle_w', 'px_star', 'px_gift', 'px_crown', 'px_lips', 'px_claw_open', 'px_claw_closed', 'px_arrow_up'];
  var BG = ['bg_sky_pink.png', 'tile_pink_sparkle.png', 'tile_lilac_sparkle.png'];

  function nb(name) { return 'assets/img/products/nu_blur_tint/' + name + '.png'; }
  function rb(name) { return 'assets/img/products/radiance_balm/' + name + '.png'; }
  function d3(name) { return 'assets/img/3d/' + name + '.png'; }
  function px(name) { return 'assets/img/px/' + name + '.svg'; }
  function bg(file) { return 'assets/img/bg/' + file; }
  // 0 -> bare lips, i>=1 -> lips painted with shade NB[i-1] (lips_v4 = matte Nu Blur set, 1100x698)
  function lips(i) { return 'assets/img/3d/lips_v4/' + (i ? 'lips_' + NB[i - 1] : 'lips_00_nude') + '.png'; }
  // official Nu Blur lip swatch photo of shade NB[i] (i 0-based), 1200x960 — colour reference, never filtered
  function photo(i) { return 'assets/img/lips_photo/' + NB[i] + '.jpg'; }
  // v2.3: 8-bit Nu Blur tube of shade NB[i] (i 0-based), 24x96 — integer scales only, image-rendering: pixelated
  function tube(i) { return 'assets/img/px/tube/px_tube_' + NB[i] + '.png'; }

  function list() {
    var out = [], i;
    for (i = 0; i < NB.length; i++) out.push(nb(NB[i]));
    for (i = 0; i < RB.length; i++) out.push(rb(RB[i]));
    for (i = 0; i <= NB.length; i++) out.push(lips(i));
    for (i = 0; i < NB.length; i++) out.push(photo(i));
    for (i = 0; i < NB.length; i++) out.push(tube(i));
    for (i = 0; i < D3.length; i++) out.push(d3(D3[i]));
    for (i = 0; i < PX.length; i++) out.push(px(PX[i]));
    for (i = 0; i < BG.length; i++) out.push(bg(BG[i]));
    out.push('assets/img/logo.png', 'assets/img/logo_white.png');
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

  var api = { NB: NB, NB_NAMES: NB_NAMES, RB: RB, RB_NAMES: RB_NAMES, cache: {}, nb: nb, rb: rb, lips: lips, photo: photo, tube: tube, d3: d3, px: px, bg: bg, list: list, preload: preload };
  window.ASSETS = api;
})();
