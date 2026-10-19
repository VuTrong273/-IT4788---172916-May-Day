# May Day backend

Backend cho hệ thống May Day, viết bằng NestJS và TypeScript. Mobile và web sẽ cùng gọi API này. Hợp đồng API của dự án nằm trong [OpenAPI](<../Docs/[MayDay] openapi.yaml>); README này chỉ hướng dẫn chạy và làm việc với code backend.

## Trạng thái hiện tại

Backend đã có bộ khung NestJS và cấu hình môi trường. Hiện chỉ có route mẫu `GET /` trả về `Hello World!` để kiểm tra server. Chưa có API `/api/v1`, đăng nhập, kết nối PostgreSQL/MinIO hay Docker Compose. Route mẫu không phải chức năng của May Day.

Các chức năng cần triển khai được mô tả trong [phạm vi backend](../Docs/CHUC_NANG_BACKEND.md). Đừng dùng tài khoản demo hard-code trong mobile để kết luận backend đã tích hợp xong.

## Chạy trên máy cá nhân

Để thống nhất môi trường phát triển, dùng Node.js 24.15 trở lên và npm. Mức này cũng đáp ứng yêu cầu của công cụ tạo module NestJS. Từ thư mục gốc repository:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run start:dev
```

Trước khi chạy `start:dev`, mở `backend/.env` và điền `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `JWT_SECRET` cùng mật khẩu trong `DATABASE_URL`. `JWT_SECRET` cần ít nhất 32 ký tự; không dùng lại secret mẫu hoặc commit file `.env`. Cấu hình thiếu/sai sẽ khiến server dừng với tên biến cần sửa. PostgreSQL và MinIO **chưa được kết nối**, nên việc server chạy không chứng minh hai dịch vụ đó đã hoạt động.

Mặc định server nghe ở `http://localhost:3000`. Mở PowerShell khác và thử:

```powershell
Invoke-RestMethod http://localhost:3000/
```

Kết quả hiện tại là `Hello World!`. `start:dev` tự khởi động lại khi sửa code; nhấn `Ctrl+C` để dừng. Chưa cần chạy Docker ở bước này.

## Kiểm tra trước khi commit

Chạy trong thư mục `backend/`:

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

`build` kiểm tra biên dịch; `lint` kiểm tra mã nguồn; `test` chạy unit test; `test:e2e` gọi thử ứng dụng qua HTTP. Các test hiện tại kiểm tra cấu hình môi trường và route mẫu, chưa kiểm tra nghiệp vụ May Day. Khi thêm một API, bổ sung test cho cả trường hợp thành công, dữ liệu sai và sai quyền.

## Các file chính

- `src/main.ts`: đọc `.env`, kiểm tra cấu hình rồi khởi động ứng dụng ở `PORT` (mặc định `3000`).
- `src/config/env.ts`: đọc và kiểm tra cấu hình PostgreSQL, MinIO, JWT trước khi server mở cổng; chưa tạo kết nối đến các dịch vụ này.
- `src/app.module.ts`: module gốc, nơi nối các module nghiệp vụ về sau.
- `src/app.controller.ts`: route HTTP mẫu; controller nhận request và trả response.
- `src/app.service.ts`: logic mẫu được controller gọi.
- `src/app.controller.spec.ts`, `test/app.e2e-spec.ts`: test mẫu.

Khi bắt đầu làm API thật, tạo module theo từng phần nghiệp vụ như auth, profile, medical records; không dồn toàn bộ endpoint vào `AppController`.

## Quy ước khi phát triển API

- Đọc endpoint, schema, mã lỗi và quyền trong [OpenAPI](<../Docs/[MayDay] openapi.yaml>) trước khi code. Cấu trúc database tham chiếu [schema SQL](../Database/000_RelationshipTable.sql) và [seed RBAC](../Database/001_Seed_RBAC.sql).
- Base path dự kiến là `/api/v1`; response có dạng `{code, message, data}` theo OpenAPI. **Bộ khung hiện tại chưa áp dụng các quy ước này.**
- PRD xác định ba nhóm actor Patient, Staff, Admin. Bản demo đầu tiên dùng các role mặc định `admin`, `doctor`, `patient`; `doctor` không đại diện cho toàn bộ Staff. Xem [phạm vi chức năng backend](../Docs/CHUC_NANG_BACKEND.md).
- Không commit `.env`, mật khẩu, token hoặc dữ liệu bệnh nhân thật. `.env.example` chỉ liệt kê tên biến và giá trị minh họa, không chứa secret thật.
- Nếu cần thay đổi request/response hoặc quyền so với OpenAPI, thống nhất với người làm mobile/web và cập nhật tài liệu trước khi ghép code.

Phạm vi hiện tại là chạy và demo hệ thống cục bộ theo [PRD](<../Docs/[MayDay] Product Requirements Document.pdf>), chưa phải hướng dẫn triển khai production.
