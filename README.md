# StudyTask — HTML/CSS/JS + Firebase

Bản này KHÔNG dùng React/Vite. Có thể mở bằng VS Code + Live Server.

## Chạy
1. Giải nén.
2. Mở thư mục bằng VS Code.
3. Cài extension Live Server.
4. Chuột phải `index.html` → Open with Live Server.
5. Trình duyệt mở dạng `http://127.0.0.1:5500/...`.

## Firebase
Đã gắn Web App config của project `t1-myschedule` trong `firebase-config.js`.

Firebase Console cần bật:
- Authentication → Email/Password
- Authentication → Google
- Firestore Database

## Role
Tài khoản mới = `user`.

Role thật không nên cho frontend tự sửa:
- user
- moderator
- assistant
- admin

Custom Claims sẽ được Cloud Functions/Admin SDK cấp. `users.role` chỉ dùng để hiển thị.

## Nâng cấp sau này
Giữ nguyên HTML/CSS/JS cũng được. Có thể thêm:
1. Cloud Functions tính điểm.
2. Custom Claims + phân quyền thật.
3. Leaderboard tuần.
4. Tự động thăng cấp Chủ nhật.
5. Pagination/filter.
6. PWA/offline.
7. Sau này nếu muốn học React thì chuyển từng phần sang React, không cần vứt toàn bộ giao diện.
