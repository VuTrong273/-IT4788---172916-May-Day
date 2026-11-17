# May Day Mobile

Ứng dụng Expo SDK 58 / React Native dùng chung backend với web, không có dữ liệu giả khi API không hoạt động.

## Chạy trên điện thoại

1. Khởi động backend từ thư mục `backend`: `docker compose up -d`. Khi dùng điện thoại, đặt `API_BIND_HOST=0.0.0.0` trong `backend/.env`, sau đó chạy `docker compose up -d api` để áp dụng.
2. Điện thoại và máy tính kết nối cùng Wi-Fi.
3. Trong thư mục `mobile`, chạy `npm ci` rồi `npm start`, quét QR bằng Expo Go phù hợp SDK 58 hoặc development build.

`npm start` tự chọn IPv4 LAN của máy tính, kiểm tra backend rồi khởi động Expo với cache mới. Nếu địa chỉ trong `.env.local` vẫn thuộc máy, địa chỉ đó được giữ lại; địa chỉ HTTPS được giữ để dùng backend từ xa. URL được truyền trực tiếp vào tiến trình Expo, không ghi đè file môi trường.

Nếu có nhiều card mạng hoặc backend ở máy khác, đặt URL rõ ràng trước khi chạy:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://192.168.1.10:3000/api/v1'
npm start
```

Thay IP trên bằng IP máy chạy backend. Mở `http://<IP>:3000/` trên trình duyệt điện thoại phải thấy `Hello World!`; nếu không, kiểm tra cùng mạng và quyền truy cập cổng 3000 trong Windows Firewall. `localhost` trên điện thoại trỏ về chính điện thoại.

`npm run start:expo` dùng cấu hình Expo trực tiếp; `npm run web` chạy giao diện trên trình duyệt. Với hai lệnh này, cấu hình `EXPO_PUBLIC_API_URL` trong `.env.local` theo [.env.example](./.env.example). Khởi động lại Expo khi đổi URL.

## Các luồng đã nối backend

- Đăng ký, đăng nhập, hồ sơ, đổi mật khẩu và email khôi phục.
- Chọn mẫu phiếu đang hoạt động, tạo bệnh án, lịch sử khám, lưu câu trả lời, bác sĩ tiếp nhận và hoàn tất.
- Nhật ký đợt tổn thương: tạo, xem, sửa, xóa.
- Chấm UAS7 theo ngày, lịch sử và tổng tuần khi có bệnh án đang khám.
- Tải ảnh đơn/nhiều ảnh, thư viện ảnh, gắn/gỡ ảnh câu trả lời. Backend lưu MinIO và trả URL có chữ ký, hiệu lực một giờ; tải lại danh sách để lấy URL mới.
- Xét nghiệm, đơn thuốc, quản trị người dùng, cơ sở, mẫu phiếu và phân quyền dùng cùng API với web.

Mẫu phiếu được người dùng chọn theo hướng dẫn cơ sở y tế. Hiện chưa có bộ quy tắc chẩn đoán/phân loại tự động được cấu hình. Backend kiểm tra vai trò, quyền sở hữu bệnh án và chặn sửa dữ liệu khi bệnh án đã hoàn tất.

## Kiểm tra

```powershell
npm run lint
npx tsc --noEmit
npm test
npx expo export --platform android --platform web
```

Export kiểm tra đóng gói JavaScript và tài nguyên; không tạo APK hoặc thay thế kiểm thử trên điện thoại thật. Bộ kiểm thử giao diện web sẵn có chạy bằng `npm run test:e2e:web` khi đã cài trình duyệt Playwright.
