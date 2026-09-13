# SchoolTask Mobile Push V3.2

Fixes the browser error:
`Failed to register a ServiceWorker ... firebase-messaging-sw.js: ServiceWorker script evaluation failed`

Changes:
- Service worker no longer initializes Firebase SDK inside the worker.
- Uses native Push API `push` event to display FCM Web Push payloads.
- Uses absolute root service-worker URL and scope `/`.
- Keeps the Firebase VAPID public key already configured in `app.js`.

After deploying:
1. Open the site once.
2. Remove/unregister the old Service Worker in browser Site settings / DevTools.
3. Clear site data for the domain.
4. Reload and press `Bật thông báo trên điện thoại`.
5. On Android Chrome, allow notifications.

Important: FCM backend/functions must still be deployed for actual remote notifications. The Service Worker only handles the browser-side receipt/display.
