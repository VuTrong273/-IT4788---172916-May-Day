# May Day Web

Ứng dụng web desktop cho nhân viên y tế và quản trị viên, dùng React, TypeScript, Vite và React Router. Đây là cổng nghiệp vụ riêng; Expo Web trong `../mobile/` là bản trình duyệt của app bệnh nhân/nhân viên và chia sẻ code với Android/iOS. Hai frontend gọi cùng API backend và theo một hệ thống màu May Day, nhưng component tách riêng theo nền tảng.

## Khởi chạy

```bash
npm ci
npm run dev
```

Mặc định Vite chuyển tiếp `/api/*` đến `http://localhost:3000`, phù hợp khi backend chạy local. Nếu API ở nơi khác, tạo `web/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
```

Node.js cần phiên bản 22.12 trở lên. Build production bằng `npm run build`; kiểm tra kiểu bằng `npm run typecheck`.

## Cấu trúc

```text
src/
  app/                 Router và các route composition
  components/
    layout/            Sidebar, topbar, app shell, navigation
    ui/                Button, field, table, badge, panel, icon, page header
  features/
    auth/              Đăng nhập, phiên làm việc, hồ sơ, đổi mật khẩu
    dashboard/         Trang tổng quan
    medical-records/   API, danh sách, chi tiết và tiếp nhận bệnh án
    modules/           Trạng thái các module đang chờ backend
    profile/           Màn hình hồ sơ tài khoản
  lib/api/             HTTP client, xử lý envelope và lỗi API
  styles/              Design tokens và style nền tảng/responsive
```

### Quy ước

- Thêm màn hình trong `features/<feature>/`; route trong `app/` chỉ ghép component và quyền truy cập.
- Thành phần tái sử dụng đặt trong `components/ui/`; layout điều hướng đặt trong `components/layout/`.
- API, kiểu dữ liệu và trạng thái tải/lỗi nằm cùng feature. Dùng `lib/api/client.ts` cho request để đồng nhất token, response envelope và lỗi phiên.
- Thiết kế responsive trước cho desktop, sau đó co về tablet/mobile; dùng CSS variables từ `styles/tokens.css`.
- Không đưa dữ liệu bệnh nhân giả vào màn hình và không giả vờ ghi thành công nếu endpoint chưa có.

## Luồng đã kết nối API

- Đăng nhập, quên mật khẩu/OTP và đổi mật khẩu cho nhân viên; phiên hiện lưu trong `sessionStorage`.
- Dashboard lấy số bệnh án theo trạng thái từ `GET /medical_records/all`.
- Danh sách và chi tiết bệnh án lấy dữ liệu thật; bác sĩ có thể tiếp nhận qua `POST /medical_records/{id}/accept`.
- Hồ sơ cá nhân đọc/cập nhật qua `/profile`; đổi mật khẩu gọi `/auth/change-password`.

Các trang bệnh nhân, tài khoản nhân viên, cơ sở khám, mẫu phiếu, phân quyền, xét nghiệm và đơn thuốc hiện là khung phạm vi, chưa phải giao diện nghiệp vụ hoàn chỉnh. Hợp đồng OpenAPI có mô tả các endpoint này, nhưng source backend hiện tại chưa có route runtime tương ứng. Web không gửi request ghi giả cho các phần này.

Đặc tả nghiệp vụ và ánh xạ từng module/role/endpoint nằm tại [`../Docs/WEB_REQUIREMENTS_MAP.md`](../Docs/WEB_REQUIREMENTS_MAP.md). OpenAPI là hợp đồng đích; trạng thái backend runtime phải được xác minh riêng. Các module đang chờ vẫn là khung phạm vi, chưa phải giao diện nghiệp vụ hoàn chỉnh.
