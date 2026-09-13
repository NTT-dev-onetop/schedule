/* SchoolTask Mobile Web Push Service Worker */
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBp4Iht5dmkHNVu9_bgQ8R1sfeSpH8STq8",
  authDomain: "t1-myschedule.firebaseapp.com",
  projectId: "t1-myschedule",
  storageBucket: "t1-myschedule.firebasestorage.app",
  messagingSenderId: "426393869723",
  appId: "1:426393869723:web:db2dc3ce7b02cb3e24953e",
  measurementId: "G-M09P6LRX1M"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload && payload.notification ? payload.notification : {};
  const data = payload && payload.data ? payload.data : {};
  const title = notification.title || data.title || "🔔 SchoolTask";
  const body = notification.body || data.body || "Bạn có thông báo mới.";
  const url = data.url || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/img/tải xuống.png",
    badge: "/img/tải xuống.png",
    tag: data.tag || "schooltask",
    renotify: true,
    data: { url, taskId: data.taskId || "" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification && event.notification.data
    ? event.notification.data.url
    : "/";
  const url = new URL(target || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client && client.url !== url) {
            return client.navigate(url).then(() => client.focus());
          }
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
