// Only here so the parents' browsers can show a notification when the site
// is closed. No caching, no offline mode — the page always loads fresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch { /* empty push */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wireman Family School', {
      body: data.body || '',
      tag: data.tag,
      icon: 'favicon.svg',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
