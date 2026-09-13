# SchoolTask Mobile Push V3.4

- Firebase project remains `t1-myschedule`.
- VAPID public key restored to the original key for that project.
- Service worker is at deployment root: `/firebase-messaging-sw.js`.
- Firestore rules allow the signed-in user to create/update their own `users/{uid}/fcmTokens/*`.
- The UI now reports a specific Firestore permission error instead of the generic notification permission message.

Deploy the project root containing `index.html`, `app.js`, `firebase-config.js`, and `firebase-messaging-sw.js`.
