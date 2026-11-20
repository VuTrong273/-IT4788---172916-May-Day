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
    operations/        Bệnh nhân, tài khoản, cơ sở, mẫu phiếu, phân quyền và điều trị
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

Các trang bệnh nhân, tài khoản nhân viên, cơ sở khám, mẫu phiếu, phân quyền, xét nghiệm và đơn thuốc đã có danh sách, biểu mẫu và API client trong [features/operations](src/features/operations/). Các trang dùng API thật được mô tả trong [danh mục backend](../backend/OPERATIONS_API.md):

- **Bác sĩ:** tìm/tạo hồ sơ bệnh nhân; xem xét nghiệm, tạo chỉ định, nhập/cập nhật kết quả từng phần; kê và xem đơn thuốc trong bệnh án được phân công.
- **Admin:** tạo/sửa/khóa/xóa tài khoản và phân công nhân viên; quản lý chi nhánh/khoa/phòng; thiết kế mẫu → phần → câu hỏi → lựa chọn; quản lý vai trò, quyền, API và các ánh xạ quyền. Admin xem xét nghiệm và đơn thuốc ở chế độ chỉ đọc.
- Màn hình xét nghiệm/đơn thuốc cho phép chọn bệnh án trong danh sách hoặc nhập mã. Hai phần này cũng hiển thị trong trang chi tiết bệnh án. Bệnh án hoàn tất chỉ được xem; bác sĩ phải tiếp nhận bệnh án trước khi thao tác lâm sàng.
- Form phân công lọc khoa theo chi nhánh, phòng theo khoa và xóa lựa chọn con khi đổi cấp cha. Các thao tác xóa có xác nhận; lỗi API giữ lại dữ liệu biểu mẫu. Danh sách có trạng thái tải/lỗi/rỗng, phân trang khi endpoint hỗ trợ.
- HTTP client nhận cả mã thành công `1000` và `1001`. Lỗi token của request đã xác thực xóa phiên và chuyển về đăng nhập; sai mật khẩu đăng nhập được hiển thị riêng.

## Kiểm tra frontend

```powershell
npm run build
npm run typecheck
```

Đặc tả nghiệp vụ và ánh xạ từng module/role/endpoint nằm tại [WEB_REQUIREMENTS_MAP.md](../Docs/WEB_REQUIREMENTS_MAP.md). Chi tiết bệnh án hỗ trợ phiếu khám động, câu hỏi điều kiện, câu trả lời và ảnh, hoàn tất khám, đóng/mở theo dõi, xem UAS7 và ảnh tổn thương theo mốc. Admin xóa bệnh án có xác nhận. Hồ sơ nhân viên cập nhật họ tên và giới tính. Vai trò tùy chỉnh được nhận diện qua `base_role` do backend trả về; quyền API vẫn được kiểm tra tại máy chủ.
