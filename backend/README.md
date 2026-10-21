# May Day backend

Backend cho hệ thống May Day, viết bằng NestJS và TypeScript. Mobile và web sẽ cùng gọi API này. Hợp đồng API của dự án nằm trong [OpenAPI](<../Docs/[MayDay] openapi.yaml>); README này chỉ hướng dẫn chạy và làm việc với code backend.

## Trạng thái hiện tại

Backend đã có bộ khung NestJS, cấu hình môi trường và Docker Compose để chạy API cùng PostgreSQL, kho ảnh S3 trên máy cá nhân. Khi tạo volume PostgreSQL mới, Compose nạp hai file SQL trong `Database/` để tạo bảng và dữ liệu RBAC mẫu. `POST /api/v1/auth/signup` tạo tài khoản bệnh nhân và hồ sơ trong cùng transaction. `POST /api/v1/auth/login` kiểm tra mật khẩu bcrypt và cấp JWT có `jti`, hết hạn sau một giờ. Các route API còn lại mặc định phải có JWT hợp lệ; guard kiểm tra chữ ký, hạn dùng, trạng thái tài khoản, danh sách token bị thu hồi và thời điểm đổi mật khẩu. Sau xác thực, guard tra `(method, path)` trong `api_endpoints` và quyền của role qua `permissions_endpoints`, `role_permissions`; không có quyền thì trả `403 / 3101`. Endpoint chưa được đăng ký cũng bị từ chối. `GET /api/v1/profile` trả hồ sơ của người đang đăng nhập. Route `GET /` vẫn chỉ trả `Hello World!` để kiểm tra server. Chưa triển khai lưu ảnh.

Các chức năng cần triển khai được mô tả trong [phạm vi backend](../Docs/CHUC_NANG_BACKEND.md). Mobile hiện chỉ dùng API thật; phải cấu hình `EXPO_PUBLIC_API_URL` trước khi đăng nhập.

## Chạy bằng Docker Compose

Mở Docker Desktop trước. Từ thư mục `backend/`:

```powershell
Copy-Item .env.example .env
```

Trong `.env`, điền `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `JWT_SECRET`. Sửa `DATABASE_URL` để dùng đúng user, mật khẩu, tên DB và cổng PostgreSQL ở `localhost` nếu sau này chạy API trực tiếp bằng npm. Mật khẩu DB cho cấu hình Compose hiện tại nên chỉ dùng chữ/số để ghép vào URL kết nối; không commit `.env`. `JWT_SECRET` cần ít nhất 32 ký tự. Các giá trị trong `.env.example` chỉ là ví dụ, không phải secret dùng được.

```powershell
docker compose up --build -d
docker compose ps
docker compose logs db minio-init api
Invoke-RestMethod http://localhost:3000/
```

Compose dùng `pgsty/silo` cho môi trường local vì image MinIO chính chủ hiện không tải được từ Docker Hub hoặc Quay trên máy đang thử. Silo là fork tương thích S3 của MinIO, không phải image do MinIO phát hành; `minio-init` dùng `mcli` đi kèm để tạo bucket. Hợp đồng API của dự án không thay đổi. Nếu bước tải image còn lỗi, chạy riêng `docker pull docker.io/pgsty/silo:RELEASE.2026-10-18T00-00-00Z` để xem thông báo đầy đủ; lỗi này xảy ra trước khi API hoặc SQL khởi động.

Kết quả HTTP hiện tại là `Hello World!`. PostgreSQL nghe tại `localhost:5432`, MinIO API tại `localhost:9000`, MinIO Console tại `http://localhost:9001`. Cổng có thể đổi qua `POSTGRES_PORT`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`, `API_PORT`. Mặc định các cổng chỉ mở trên máy chạy Docker. Khi cần thử API bằng điện thoại trong cùng Wi-Fi, đặt `API_BIND_HOST=0.0.0.0` và cấu hình mobile gọi địa chỉ IP LAN của máy; chỉ làm vậy trong mạng tin cậy.

Để thử đăng nhập sau khi `docker compose up --build -d`, dùng tài khoản admin demo của seed SQL:

```powershell
$body = @{ phone = '0900000000'; password = 'Admin@123' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/auth/login' -ContentType 'application/json' -Body $body
```

Kết quả thành công có `code: "1000"`, `data.token` và `data.user_info`. Đây chỉ là tài khoản demo cho local; không dùng trên server công khai. Không commit hoặc chia sẻ token nhận được.

Để thử route cần đăng nhập, dùng token vừa nhận (chạy trong cùng cửa sổ PowerShell):

```powershell
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/auth/login' -ContentType 'application/json' -Body $body
Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/profile' -Headers @{ Authorization = "Bearer $($login.data.token)" }
```

Kết quả thành công có `code: "1000"` và `data` là hồ sơ admin. Nếu gọi `/api/v1/profile` không có token, API trả HTTP 401 với `code: "3003"`. Token sai hoặc đã hết hạn lần lượt trả `3001` hoặc `3002`.

Để tạo tài khoản bệnh nhân, mở app, chọn **Bệnh nhân → Đăng ký**, nhập họ tên, số điện thoại mới và mật khẩu tối thiểu 6 ký tự. Backend tự gán role `patient`, băm mật khẩu và tạo cả hồ sơ trong bảng `patients`. Sau khi đăng ký, app chuyển về màn hình đăng nhập. Số điện thoại đã tồn tại trả `409 / 3006`; API không trả mật khẩu hoặc hash.

```powershell
docker compose down
```

Lệnh trên dừng và xóa container nhưng giữ dữ liệu trong volume. Hai script `Database/000_RelationshipTable.sql` và `Database/001_Seed_RBAC.sql` **chỉ chạy khi PostgreSQL khởi tạo volume trống lần đầu**. Nếu sửa SQL về sau, cần migration; `docker compose up` không tự chạy lại script. Seed hiện chứa tài khoản admin demo `0900000000 / Admin@123`, chỉ dùng ở môi trường thử nghiệm, không đưa lên server công khai. Không dùng `docker compose down -v` nếu cần giữ dữ liệu: lệnh đó xóa cả volume database và ảnh.

Compose đặt tên volume riêng `mayday_postgres_data_v1` và `mayday_minio_data_v1` để tránh dùng nhầm dữ liệu của project khác. Nếu đã từng chạy bản Compose dùng tên volume cũ, việc chạy lại sẽ tạo volume May Day mới; volume cũ không bị xóa. Healthcheck PostgreSQL thử đăng nhập vào database May Day, không chỉ kiểm tra cổng đã mở.

## Chạy API trực tiếp bằng npm

Để thống nhất môi trường phát triển, dùng Node.js 24.15 trở lên và npm. Mức này cũng đáp ứng yêu cầu của công cụ tạo module NestJS. Từ thư mục gốc repository:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run start:dev
```

Trước khi chạy `start:dev`, điền các biến trong `.env` như phần Docker Compose. Nếu đã tạo `.env`, không cần `Copy-Item` lần nữa. Có thể chạy riêng PostgreSQL và kho ảnh bằng `docker compose up -d db minio minio-init`, rồi chạy API bằng npm để tự reload khi sửa code. Chức năng đăng nhập dùng PostgreSQL khi có request; MinIO chưa được gọi từ API.

Mặc định server nghe ở `http://localhost:3000`. Mở PowerShell khác và thử:

```powershell
Invoke-RestMethod http://localhost:3000/
```

Kết quả hiện tại là `Hello World!`. `start:dev` tự khởi động lại khi sửa code; nhấn `Ctrl+C` để dừng.

## Kiểm tra trước khi commit

Chạy trong thư mục `backend/`:

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

`build` kiểm tra biên dịch; `lint` kiểm tra mã nguồn; `test` chạy unit test; `test:e2e` gọi thử ứng dụng qua HTTP. Các test API dùng repository giả; để xác nhận PostgreSQL thật, chạy request đăng nhập và xem hồ sơ ở trên sau khi dựng Compose.

## Các file chính

- `src/main.ts`: đọc `.env`, kiểm tra cấu hình rồi khởi động ứng dụng ở `PORT` (mặc định `3000`).
- `src/config/env.ts`: đọc và kiểm tra cấu hình PostgreSQL, MinIO, JWT trước khi server mở cổng.
- `src/app.module.ts`: module gốc, nơi nối các module nghiệp vụ.
- `src/auth/`: API đăng ký bệnh nhân, đăng nhập, truy vấn tài khoản, cấp và kiểm tra JWT.
- `src/profile/`: API xem hồ sơ cá nhân của người đang đăng nhập.
- `src/app.controller.ts`: route HTTP mẫu; controller nhận request và trả response.
- `src/app.service.ts`: logic mẫu được controller gọi.
- `src/app.controller.spec.ts`, `test/app.e2e-spec.ts`: test mẫu.

Khi bắt đầu làm API thật, tạo module theo từng phần nghiệp vụ như auth, profile, medical records; không dồn toàn bộ endpoint vào `AppController`.

## Quy ước khi phát triển API

- Đọc endpoint, schema, mã lỗi và quyền trong [OpenAPI](<../Docs/[MayDay] openapi.yaml>) trước khi code. Cấu trúc database tham chiếu [schema SQL](../Database/000_RelationshipTable.sql) và [seed RBAC](../Database/001_Seed_RBAC.sql).
- API nghiệp vụ dùng base path `/api/v1`; response có dạng `{code, message, data}` theo OpenAPI. Hiện đã có `POST /auth/signup`, `POST /auth/login` và `GET /profile`; route mẫu `GET /` nằm ngoài API nghiệp vụ.
- PRD xác định ba nhóm actor Patient, Staff, Admin. Bản demo đầu tiên dùng các role mặc định `admin`, `doctor`, `patient`; `doctor` không đại diện cho toàn bộ Staff. Xem [phạm vi chức năng backend](../Docs/CHUC_NANG_BACKEND.md).
- Không commit `.env`, mật khẩu, token hoặc dữ liệu bệnh nhân thật. `.env.example` chỉ liệt kê tên biến và giá trị minh họa, không chứa secret thật.
- Nếu cần thay đổi request/response hoặc quyền so với OpenAPI, thống nhất với người làm mobile/web và cập nhật tài liệu trước khi ghép code.

Phạm vi hiện tại là chạy và demo hệ thống cục bộ theo [PRD](<../Docs/[MayDay] Product Requirements Document.pdf>), chưa phải hướng dẫn triển khai production.
