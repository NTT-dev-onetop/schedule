# SchoolTask V3 — Mobile Notification

Bản này tập trung vào **điện thoại**: Android Chrome và iPhone/iPad Safari hỗ trợ Web Push (iOS/iPadOS 16.4+), để nhận thông báo khi SchoolTask không mở ở foreground.

## 1. Bắt buộc: VAPID key
Firebase Console → Project settings → Cloud Messaging → Web configuration → Web Push certificates → lấy **Public key**.

Mở `app.js`, thay:
`PASTE_YOUR_FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY_HERE`

bằng Public key của dự án.

## 2. Android
Mở SchoolTask bằng Chrome → đăng nhập → bấm **Bật thông báo trên điện thoại** → Allow. Có thể thêm trang vào màn hình chính để dùng như app.

## 3. iPhone/iPad
iOS/iPadOS 16.4+ → mở bằng Safari → **Add to Home Screen** → mở SchoolTask từ biểu tượng vừa thêm → đăng nhập → bấm **Bật thông báo trên điện thoại** → Allow.

## 4. Deploy
Cần Firebase CLI và bật Cloud Functions. Chạy:
`firebase deploy --only hosting,firestore,functions`

Function `notifyNewTask` gửi thông báo khi có nhiệm vụ mới. `notifyDeadlines` kiểm tra mỗi 5 phút để nhắc trước khoảng 24 giờ và 1 giờ. Scheduled Functions có thể yêu cầu dự án Firebase/Google Cloud có billing phù hợp.

## 5. Lưu ý
- Phải dùng HTTPS/Firebase Hosting (localhost cũng có ngoại lệ trong môi trường phát triển).
- Người dùng phải cấp quyền thông báo.
- iPhone phải chạy bản iOS/iPadOS hỗ trợ Web Push và dùng website đã Add to Home Screen.
- Không dùng `new Notification()` cho background nữa; Service Worker + FCM xử lý background notification.
