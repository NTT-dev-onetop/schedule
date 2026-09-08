# SchoolTask — t1-myschedule

Web App HTML/CSS/Vanilla JS + Firebase Authentication + Firestore.

## Cài đặt
1. Tạo Firebase Web App trong project `t1-myschedule`.
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
