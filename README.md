# SchoolTask — englishproject-c0131

Web App HTML/CSS/Vanilla JS + Firebase Authentication + Firestore.

## Cài đặt
1. Tạo Firebase Web App trong project `englishproject-c0131`.
2. Cấu hình đã được đặt trong `firebase-config.js`.
3. Firebase Console → Authentication → Sign-in method → bật Email/Password.
4. Firebase Console → Firestore Database → tạo database.
5. Deploy rules:
   `firebase deploy --only firestore:rules`
6. Deploy web:
   `firebase deploy --only hosting`

## Lưu ý
- Không đưa service account/private key vào frontend.
- Firebase Web API key không phải secret; quyền truy cập dữ liệu được kiểm soát bằng Authentication + Firestore Rules.
- App dùng giờ địa phương của trình duyệt cho ngày/giờ nhiệm vụ.
- Firestore queries cho tasks/leaderboard có thể yêu cầu composite index tùy cấu hình Firebase; nếu Console báo thiếu index, tạo index theo link Firebase cung cấp.

## Đăng nhập
Luồng xác thực dùng `signInWithEmailAndPassword` + `onAuthStateChanged`, hiển thị trực tiếp mã lỗi Firebase thân thiện trên form và ghi lỗi kỹ thuật ra Console để debug.


## Firebase source
This build uses the Firebase configuration from `english.zip` (`englishproject-c0131`).


## Đăng nhập
- App hiện chỉ dùng **Đăng nhập bằng Google (Gmail)** qua Firebase Authentication `GoogleAuthProvider` + `signInWithPopup`.
- Khi người dùng Google đăng nhập lần đầu, app tự tạo hồ sơ trong `users/{uid}`.
- Trong Firebase Console cần bật **Authentication → Sign-in providers → Google** và thêm domain triển khai vào **Authorized domains**.
- Firebase config được lấy từ project của `english.zip`: `englishproject-c0131`.


## Thông báo ngoài web / khóa màn hình
- App đã được nâng cấp thành PWA + Firebase Cloud Messaging (FCM).
- Khi người dùng bật **Bật thông báo ngoài web**, trình duyệt lưu FCM token vào `users/{uid}/notificationTokens`.
- Cloud Functions gửi nhắc hạn còn **24 giờ** và **1 giờ**, kể cả khi tab/web không mở, nếu thiết bị/trình duyệt vẫn cho phép push.
- Cần cấu hình **Web Push VAPID public key** trong `notification-config.js` từ Firebase Console → Project settings → Cloud Messaging → Web Push certificates.
- Deploy: `firebase deploy --only hosting,firestore:rules,functions`. Functions cần project Firebase hỗ trợ Cloud Functions/billing theo chính sách Firebase hiện hành.
- Không thể đảm bảo thông báo nếu người dùng chặn notification, tắt quyền trình duyệt, hoặc hệ điều hành giới hạn hoàn toàn hoạt động nền.
