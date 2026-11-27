/* v2.8.13: StanbyME video page only (tv.html opened from raw.githack.com). Pages: network first, the stored tv.html copy
   without network. Video: answered from the page's stored copy (range requests sliced from the cached Blob); URLs with
   ?net=1 go straight to the network (fallback the page switches to when playback gets stuck). */
var U = 'https://marketingactsonevn-dot.github.io/hince-led-game/assets/video/standby_tv.mp4';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
function video(req) {
  return caches.open('hince-tv-video-v1').then(function (c) { return c.match(U); }).then(function (hit) {
    if (!hit) return fetch(req);
    var range = req.headers.get('range');
    if (!range) return hit;
    return hit.blob().then(function (b) {
      var n = b.size, m = /bytes=(\d*)-(\d*)/.exec(range) || [], st, end;
      if (m[1] === '' && m[2]) { st = Math.max(0, n - +m[2]); end = n - 1; } // suffix range: last N bytes
      else { st = m[1] ? +m[1] : 0; end = m[2] ? Math.min(+m[2], n - 1) : n - 1; }
      return new Response(b.slice(st, end + 1), { status: 206, headers: { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
        'Content-Range': 'bytes ' + st + '-' + end + '/' + n, 'Content-Length': String(end - st + 1) } });
    });
  }).catch(function () { return fetch(req); });
}
self.addEventListener('fetch', function (e) {
  if (e.request.url === U) { e.respondWith(video(e.request)); return; }
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return caches.open('hince-tv-page-v1').then(function (c) { return c.match(e.request, { ignoreSearch: true }); })
      .then(function (hit) { return hit || Response.error(); });
  }));
});
