/* v2.8.13: StanbyME video page only (tv.html opened from raw.githack.com). Network first; without network the copy of
   tv.html that the page stored in 'hince-tv-page-v1' is served. The video itself is played from the page's Cache API copy. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return caches.open('hince-tv-page-v1').then(function (c) { return c.match(e.request, { ignoreSearch: true }); })
      .then(function (hit) { return hit || Response.error(); });
  }));
});
