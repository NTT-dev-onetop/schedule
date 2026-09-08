# Học Tập Cộng Đồng — Firebase build

Bản build giữ nguyên **Firebase Web App** của project hiện tại trong `firebase-config.js`, không đổi sang framework.

## Có gì trong bản này
- `login.html` — đăng nhập Email/Password + Google.
- `register.html` — họ tên, lớp, email, mật khẩu, xác nhận.
- `index.html` — dashboard, lịch/tiến độ nhiệm vụ hôm nay, nhiệm vụ mới.
- `community.html` — tìm kiếm, lọc môn/loại/ngày, tải thêm, tạo task.
- `leaderboard.html` — Top 10 từ collection `rankings`, Top 3 huy hiệu.
- `profile.html` — hồ sơ, thống kê, chỉnh sửa, đổi mật khẩu.
- `admin.html` — quản lý user, thống kê, cài đặt; chỉ hiện với role quản trị.
- `style.css` — responsive desktop/mobile, đúng palette và màu môn học.
- `firestore.rules` — bảo vệ dữ liệu theo Firebase Authentication + Custom Claims.

## Chạy local
Dùng VS Code + Live Server hoặc một static server. Không nên mở trực tiếp bằng `file://` vì Firebase module import cần HTTP(S).

## Firebase Console
Bật:
1. Authentication → Email/Password.
2. Authentication → Google.
3. Firestore Database.
4. Deploy `firestore.rules`.

## Phân quyền
Tài khoản đăng ký từ giao diện luôn bắt đầu ở `user`.

Quyền Firestore của Moderator/Assistant/Admin dựa trên **Firebase Auth Custom Claims**, không dựa vào việc người dùng tự sửa `users.role` trên client. Vì vậy không thể dùng frontend để tự cấp quyền Admin.

Collection `users/{uid}.role` được dùng để hiển thị; Custom Claim `role` mới là quyền bảo mật thật.

## Collections được app dùng
- `users`
- `tasks`
- `task_completions`
- `rankings`
- `weekly_stats`
- `system_settings`
- `notifications`

### Cấu trúc ranking gợi ý
Mỗi document trong `rankings` nên có:
- `displayName`
- `role`
- `points`
- `completedCount`

Collection `rankings` được thiết kế để backend/Cloud Functions cập nhật. Frontend chỉ đọc.

## Điểm và hoàn thành
Frontend chỉ tạo `task_completions/{taskId}_{uid}`. Frontend **không tự cộng điểm**, tránh việc người dùng tự sửa điểm. Việc tính điểm, weekly ranking và thăng cấp nên thực hiện bằng Cloud Functions/Admin SDK.

## Lưu ý về Admin
Nếu muốn cấp Admin thật, hãy cấp Custom Claim `role: "admin"` bằng Admin SDK/Cloud Functions hoặc môi trường quản trị an toàn. Không đặt service-account private key vào frontend.

Build/thiết kế: **Nguyễn Trung Trực**


## V3 performance
- Single entry URL `/`; tabs use History API and do not reload the page.
- Firebase Auth uses `browserLocalPersistence`.
- ID token is not force-refreshed on every tab navigation.
- Firestore listeners are initialized once and reused.
- Vercel rewrite routes clean app URLs back to `index.html`.
- Class selector is limited to `11T1`.
