# Phạm vi frontend May Day

## Mục tiêu môn học

Phát triển ứng dụng đa nền tảng cho hai bề mặt sử dụng: **mobile app** và **web portal**. Hai frontend dùng chung API/backend và dữ liệu, nhưng tối ưu theo vai trò; không cần tạo hai bản sao giao diện giống nhau.

```text
                         Backend API + PostgreSQL
                         /                     \
                        /                       \
     Mobile app (Expo, RN, iOS/Android/Web)     Web portal (React, desktop)
        patient + staff workflows                 staff + admin workflows
```

## Phân chia theo vai trò

| Nhóm người dùng | Mobile app (`mobile/`) | Web portal (`web/`) |
| --- | --- | --- |
| Bệnh nhân | Đăng ký, đăng nhập, hồ sơ, tạo/theo dõi bệnh án, ảnh và UAS7 theo thiết kế mobile | Không phải bề mặt chính trong bản hiện tại |
| Bác sĩ/nhân viên | Thao tác nhanh, xem hàng đợi và bệnh án khi di chuyển | Làm việc với danh sách, tìm kiếm và nghiệp vụ nhân viên trên màn hình lớn |
| Quản trị viên | Không gian admin không phải mục tiêu chính của mobile | Quản lý tài khoản, cơ sở khám, mẫu phiếu và RBAC |

Expo hỗ trợ chạy cùng app mobile trên iOS, Android và trình duyệt. Lệnh `npm start` hiển thị QR để mở app trên thiết bị; nhấn `w` mở bản web của **app Expo**. `web/` là web portal riêng cho nhân viên/admin, chạy bằng Vite tại cổng riêng. Vì vậy việc thấy cả QR lẫn đường dẫn web trong Expo là bình thường; trang trắng sau khi mở thì không phải trạng thái mong đợi và cần xem log/lỗi runtime.

## Phạm vi công việc frontend

Phần frontend của dự án gồm:

1. **Mobile**: route Expo Router, màn hình và component React Native, responsive theo thiết bị, tích hợp API cho bệnh nhân/nhân viên.
2. **Web**: route React, layout desktop/responsive, component HTML/CSS, tích hợp API cho nhân viên/admin.
3. **Trải nghiệm dùng chung**: cùng thuật ngữ, trạng thái bệnh án, màu sắc và quy tắc xác thực; component có thể khác theo nền tảng.
4. **Tích hợp**: dùng API thật khi đã có; có trạng thái loading/error/empty; không giả lập lưu thành công.

Backend, schema/migration database và seed không thuộc phần frontend. Khi API còn thiếu, ghi rõ phụ thuộc và tiếp tục hoàn thiện UI theo OpenAPI; không tự thêm endpoint vào backend nếu chưa được phân công.

## Kiến trúc source

- `mobile/src/app/`: route/layout Expo Router; `mobile/src/features/`: UI và nghiệp vụ theo feature; `mobile/src/components/`: UI dùng lại trên native/web.
- `web/src/app/`: router; `web/src/features/`: các trang theo nghiệp vụ; `web/src/components/ui/`: component DOM dùng lại; `web/src/components/layout/`: sidebar/topbar/app shell.
- Hai ứng dụng có runtime khác nhau. Không import component React Native sang web DOM hoặc ngược lại; chia sẻ hợp đồng API/thuật ngữ/design token bằng quy ước, không ghép hai dependency tree vào một app.
- API prefix là `/api/v1`; khi phát triển local, Expo dùng `EXPO_PUBLIC_API_URL`, Vite dùng proxy hoặc `VITE_API_URL`.

## Trạng thái tích hợp hiện tại

Theo module đang có trong `backend/src/`, API thật hiện tập trung vào đăng nhập, hồ sơ cá nhân và một phần bệnh án: danh sách, chi tiết/tóm tắt, tiếp nhận. OpenAPI mô tả phạm vi rộng hơn nhưng hợp đồng trong tài liệu không đồng nghĩa endpoint đã được triển khai.

- Luồng đăng nhập, profile và hàng đợi bệnh án đã có thể tích hợp với backend hiện tại ở cả hai bề mặt phù hợp.
- Quản trị tài khoản/cơ sở/RBAC, quản lý template, tìm kiếm bệnh nhân, tạo hồ sơ, ảnh/UAS7, xét nghiệm và đơn thuốc cần xác nhận endpoint runtime trước khi bật thao tác.
- Backend hiện có thể từ chối endpoint chưa được đăng ký quyền RBAC; khi tích hợp, phân biệt lỗi quyền với endpoint chưa được triển khai.

## Lệnh chạy

```bash
# Mobile / Expo Web
cd mobile
npm ci
npm start
# nhấn w để mở Expo Web

# Staff/admin web portal
cd web
npm ci
npm run dev
```
