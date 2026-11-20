/* global self */
/* PLAY YOUR LIFE 2.0 — сервис-воркер уведомлений.
 * Показывает системные уведомления и по нажатию открывает игру на нужном разделе.
 * Кэширования нет: игра всегда загружается с сайта. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
        client.postMessage({ type: 'pyl-open', url });
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
