// MyTankBox Service Worker – nur App-Dateien werden gecacht, nie Nutzerdaten.
// Eigene Namen je Adresse: Live unter / wie bisher, eine Test-App unter /test/ mit Präfix „test-“
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const NS = SCOPE_PATH === '/' ? '' : SCOPE_PATH.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-';
const CACHE = NS + 'tankbox-0.3.0.1';
const FILES = ['./', 'index.html', 'app.js', 'ds.js', 'manifest.webmanifest',
  'boxen/smartbox.png', 'boxen/gesundbox.png', 'boxen/belegbox.png', 'boxen/tankbox.png',
  'icons/tankbox-192.png', 'icons/tankbox-512.png', 'icons/tankbox-maskable-192.png', 'icons/tankbox-maskable-512.png',
  'icons/tankbox-180.png', 'icons/tankbox-badge-96.png'];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den HTTP-Zwischenspeicher – sonst könnte eine neue Version mit alten Dateien installiert werden
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(NS + 'tankbox-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (url.origin !== location.origin || req.method !== 'GET') return;
  // Alles aus dem Cache des aktuellen Stands, damit Seite und Skript immer zusammenpassen.
  if (req.mode === 'navigate') { e.respondWith(caches.match('index.html').then(r => r || fetch(req))); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
