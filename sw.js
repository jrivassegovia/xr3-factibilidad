// Service worker: guarda la app (pantallas, íconos, librería de mapas) para que abra rápido y sin señal.
// Las consultas al servicio de Apps Script NUNCA se guardan: siempre van a la red.
const VERSION = 'xr3-fact-v3';
const APP = ['./', 'index.html', 'app.js', 'config.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET' || url.includes('script.google') || url.includes('googleusercontent') || url.includes('routing.openstreetmap')) return;
  if (url.includes('tile.openstreetmap.org')) return;   // las teselas del mapa no se guardan
  // app: primero la red (para tomar versiones nuevas), si no hay señal usa lo guardado
  e.respondWith(fetch(e.request).then(r => {
    const copia = r.clone(); if (r.ok) caches.open(VERSION).then(c => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
