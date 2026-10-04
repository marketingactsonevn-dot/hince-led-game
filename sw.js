/* Offline cache for hosted mode (https). Bump VERSION when files change. */
var VERSION = 'hince-led-v2.4.1';
var FILES = ['./', './index.html', './manifest.webmanifest', './css/style.css',
  './js/config.js', './js/i18n.js', './js/assets.js', './js/logic.js', './js/logic2.js', './js/store.js', './js/sheet.js', './js/audio.js', './js/music.js', './js/umpah1.js', './js/taptap.js', './js/umpah2.js', './js/taptap2.js', './js/admin.js', './js/app.js',
  './assets/fonts/Silkscreen-Bold.ttf', './assets/fonts/Silkscreen-Regular.ttf', './assets/fonts/Handjet.ttf', './assets/fonts/PixelifySans-Bold.woff2',
  './assets/img/logo.png', './assets/img/logo_white.png',
  './assets/img/icon-192.png', './assets/img/icon-512.png',
  './assets/img/products/nu_blur_tint/01_near.png', './assets/img/products/nu_blur_tint/02_dear.png', './assets/img/products/nu_blur_tint/03_nu_allure.png', './assets/img/products/nu_blur_tint/04_figray.png',
  './assets/img/products/nu_blur_tint/05_hug.png', './assets/img/products/nu_blur_tint/06_nu_rose.png', './assets/img/products/nu_blur_tint/07_heart.png', './assets/img/products/nu_blur_tint/08_wild.png',
  './assets/img/products/nu_blur_tint/09_cold.png', './assets/img/products/nu_blur_tint/10_leather.png', './assets/img/products/radiance_balm/01_clear.png', './assets/img/products/radiance_balm/02_dawn_ray.png',
  './assets/img/products/radiance_balm/03_tender_room.png', './assets/img/products/radiance_balm/05_light.png', './assets/img/products/radiance_balm/gleaming.png', './assets/img/products/radiance_balm/lil_mauve.png',
  './assets/img/products/radiance_balm/shelly_pink.png', './assets/img/3d/lips_v4/lips_00_nude.png', './assets/img/3d/lips_v4/lips_01_near.png', './assets/img/3d/lips_v4/lips_02_dear.png',
  './assets/img/3d/lips_v4/lips_03_nu_allure.png', './assets/img/3d/lips_v4/lips_04_figray.png', './assets/img/3d/lips_v4/lips_05_hug.png', './assets/img/3d/lips_v4/lips_06_nu_rose.png',
  './assets/img/3d/lips_v4/lips_07_heart.png', './assets/img/3d/lips_v4/lips_08_wild.png', './assets/img/3d/lips_v4/lips_09_cold.png', './assets/img/3d/lips_v4/lips_10_leather.png',
  './assets/img/3d/star_chrome.png', './assets/img/3d/star_pink.png', './assets/img/3d/star_butter.png', './assets/img/3d/star_lilac.png',
  './assets/img/3d/sparkle_butter.png', './assets/img/3d/sparkle_chrome.png', './assets/img/3d/sparkle_pearl.png', './assets/img/3d/pearl_orb.png', './assets/img/3d/heart_pink.png',
  './assets/img/px/px_hand.svg', './assets/img/px/px_cursor.svg', './assets/img/px/px_sparkle.svg', './assets/img/px/px_sparkle_w.svg',
  './assets/img/px/px_star.svg', './assets/img/px/px_gift.svg', './assets/img/px/px_crown.svg', './assets/img/px/px_lips.svg',
  './assets/img/px/px_claw_open.svg', './assets/img/px/px_claw_closed.svg', './assets/img/px/px_arrow_up.svg',
  './assets/img/lips_photo/01_near.jpg', './assets/img/lips_photo/02_dear.jpg', './assets/img/lips_photo/03_nu_allure.jpg', './assets/img/lips_photo/04_figray.jpg',
  './assets/img/lips_photo/05_hug.jpg', './assets/img/lips_photo/06_nu_rose.jpg', './assets/img/lips_photo/07_heart.jpg', './assets/img/lips_photo/08_wild.jpg',
  './assets/img/lips_photo/09_cold.jpg', './assets/img/lips_photo/10_leather.jpg',
  './assets/img/px/tube/px_tube_01_near.png', './assets/img/px/tube/px_tube_02_dear.png', './assets/img/px/tube/px_tube_03_nu_allure.png', './assets/img/px/tube/px_tube_04_figray.png',
  './assets/img/px/tube/px_tube_05_hug.png', './assets/img/px/tube/px_tube_06_nu_rose.png', './assets/img/px/tube/px_tube_07_heart.png', './assets/img/px/tube/px_tube_08_wild.png',
  './assets/img/px/tube/px_tube_09_cold.png', './assets/img/px/tube/px_tube_10_leather.png',
  './assets/img/bg/bg_sky_pink.png', './assets/img/bg/tile_pink_sparkle.png', './assets/img/bg/tile_lilac_sparkle.png',
  './assets/video/reveal/reveal_nublur.webm', './assets/video/reveal/reveal_nublur_pink.mp4', './assets/video/reveal/reveal_nublur_end.png',
  './assets/video/reveal/reveal_balm.webm', './assets/video/reveal/reveal_balm_lilac.mp4', './assets/video/reveal/reveal_balm_end.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FILES).then(function () {
      // optional: per-kiosk config.local.js, videos + audio overrides (keys = audio.js BGM_KEYS + SFX_KEYS); cache them if present
      var opt = ['./config.local.js', './assets/video/attract.mp4', './assets/video/promo.mp4'];
      ['bgm_lobby', 'bgm_umpah', 'bgm_taptap', 'bgm_umpah2', 'bgm_taptap2', 'ui_tap', 'start', 'select', 'count', 'go', 'um_hold', 'pah', 'tube_fly', 'kiss_color',
        'perfect', 'good', 'miss', 'tap_lane_0', 'tap_lane_1', 'tap_lane_2', 'tap_lane_3', 'tap_gold', 'tap_empty', 'tap_miss', 'combo_up',
        'count_tick', 'win_t1', 'win_t2', 'no_tier', 'key', 'submit', 'staff_ok', 'kiss_pick', 'kiss_wrong', 'kiss_this', 'time_up',
        'grab_move', 'grab_drop', 'grab_close', 'grab_got', 'grab_slip', 'grab_miss', 'grab_shuffle', 'peek', 'card_flip', 'card_nomatch', 'clear'].forEach(function (k) {
        ['mp3', 'wav', 'ogg'].forEach(function (x) { opt.push('./assets/audio/' + k + '.' + x); });
      });
      return Promise.all(opt.map(function (u) { return c.add(u).catch(function () { }); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || e.request.url.indexOf(self.location.origin + '/') !== 0) return; // v2.3: Google Sheet sync goes straight to the network
  var range = e.request.headers.get('range');
  if (range) { // v2.4: video range requests (intro, attract, promo) are answered from the cache too, so the intro plays offline
    e.respondWith(caches.match(e.request.url, { ignoreSearch: true }).then(function (hit) {
      if (!hit) return fetch(e.request);
      return hit.arrayBuffer().then(function (buf) { // ponytail: whole file in memory per request; fine for files < 1 MB, stream if videos grow
        var n = buf.byteLength, m = /bytes=(\d*)-(\d*)/.exec(range) || [], st = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], n - 1) : n - 1;
        return new Response(buf.slice(st, end + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'video/mp4',
          'Content-Range': 'bytes ' + st + '-' + end + '/' + n, 'Content-Length': String(end - st + 1), 'Accept-Ranges': 'bytes' } });
      });
    }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).catch(function () { return caches.match('./index.html'); });
  }));
});
