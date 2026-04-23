// Service Worker vacío intencionalmente.
// La app se desregistra a sí misma al cargar para evitar problemas de caché.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
