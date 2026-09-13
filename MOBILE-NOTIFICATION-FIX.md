# Mobile Notification V3.1 FIXED

- Correct VAPID public key is embedded in `app.js`.
- Service Worker uses Firebase compat SDK and a root-safe scope.
- Service Worker cache is disabled through `vercel.json`.

After deployment, on the phone:
1. Open the site.
2. Clear the old site data/service worker if the old error is cached.
3. Sign in.
4. Tap **Bật thông báo trên điện thoại** and allow notifications.
5. On iPhone/iPad, use Add to Home Screen first (iOS/iPadOS 16.4+).

If the old Service Worker error remains, uninstall the PWA/site shortcut and open the site again so the new worker can install.
