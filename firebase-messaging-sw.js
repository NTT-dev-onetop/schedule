/* SchoolTask – Firebase Web Push Service Worker
 * Intentionally uses the native Push API only.
 * This avoids ServiceWorker evaluation failures caused by SDK initialization
 * inside the worker while remaining compatible with FCM Web Push payloads.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (_) {
    try { payload = { data: { body: event.data ? event.data.text() : "" } }; } catch (_) {}
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "🔔 SchoolTask";
  const body = notification.body || data.body || "Bạn có thông báo mới.";
  const icon = notification.icon || "/img/tải xuống.png";
  const badge = notification.badge || "/img/tải xuống.png";
  const url = data.url || notification.click_action || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: data.tag || "schooltask",
      renotify: true,
      data: { url, taskId: data.taskId || "" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/";
  const url = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client && client.url !== url) {
            return client.navigate(url).then(() => client.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
