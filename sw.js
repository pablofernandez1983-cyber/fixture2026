const CACHE = 'mundial2026-v41';
const ASSETS = ['./', './index.html', './icon-192.png', './icon-512.png', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Las APIs externas (ESPN, TheSportsDB, Supabase) van directo a la red, sin tocar caché.
  if (url.origin !== location.origin) return;
  // Network-first para el documento: siempre el código más fresco si hay internet;
  // si no hay, cae al caché (funciona offline). Esto evita ver versiones viejas tras un deploy.
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Cache-first para estáticos (íconos, manifest): rápidos y casi nunca cambian.
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
    return resp;
  })));
});
