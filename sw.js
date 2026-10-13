/* Load — offline shell.
   The whole app is one self-contained index.html, so caching it plus the
   icons is the entire job. Cache name carries a build stamp, so a deploy
   retires the previous cache instead of stranding an old version. */
var CACHE = 'load-33415a975a39';
var ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  /* never intercept the food lookup — it must fail loudly when offline,
     not be answered from a stale cache */
  if(url.origin !== self.location.origin) return;

  var isDoc = req.mode === 'navigate' ||
              url.pathname === '/' || /\/(index\.html)?$/.test(url.pathname);

  if(isDoc){
    /* Bypass the browser's HTTP cache when checking for a new deployment.
       GitHub Pages otherwise allows a ten-minute-old HTML response here. */
    e.respondWith(
      fetch(req, {cache:'no-store'}).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return res;
      })['catch'](function(){
        return caches.match('./index.html').then(function(m){
          return m || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(m){ return m || fetch(req); })
  );
});
