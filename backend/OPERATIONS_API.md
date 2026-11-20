# API nghiệp vụ Web

Base URL: `/api/v1`. Các API dùng JWT (`Authorization: Bearer <token>`) và kiểm tra quyền theo method + route pattern trong seed RBAC. Response giữ dạng `{code, message, data}`; các danh sách phân trang có thêm `total`, `page`, `limit` ở ngoài `data`. Tạo mới trả HTTP 201 / `1001`; đọc, sửa, xoá và gán quyền trả HTTP 200 / `1000`.

## Phạm vi đã bổ sung

| Nghiệp vụ | Endpoint |
| --- | --- |
| Bệnh nhân | `GET /doctor/patients/search?phone=...&full_name=...`, `POST /doctor/patients` |
| Tài khoản | `GET/POST /admin/users`, `GET/PUT/DELETE /admin/users/:id`, `PUT /admin/users/:id/assign`, `POST /auth/admin/create-staff` |
| Cơ sở khám | `GET/POST /branches`, `GET/PUT/DELETE /branches/:id`; tương tự cho `/departments` và `/rooms` |
| Vai trò, quyền | `GET/POST /roles`, `PUT/DELETE /roles/:id`; tương tự cho `/permissions` và `/api_endpoints` |
| Gán quyền | `POST /role_permissions`, `GET /role_permissions/role/:role_id`, `DELETE /role_permissions/role/:role_id/permission/:permission_id` |
| Gán endpoint | `POST /permission_endpoints`, `GET /permission_endpoints/permission/:permission_id`, `DELETE /permission_endpoints/permission/:permission_id/endpoint/:endpoint_id` |
| Mẫu phiếu | `POST /templates`, `GET /templates/all`, `GET/PUT/DELETE /templates/:id` |
| Phần trong mẫu | `POST /templates/:template_id/sections`, `PUT/DELETE /templates/sections/:id` |
| Câu hỏi và lựa chọn | `POST /templates/sections/:section_id/questions`, `PUT/DELETE /templates/questions/:id` |
| Đơn thuốc | `POST /prescriptions`, `GET /prescriptions/:medical_record_id` |
| Xét nghiệm | `POST /lab-requests`, `GET /lab-results/:record_id`, `POST /lab-results` |

Tổng cộng 58 operation mới. Request/schema chi tiết theo [OpenAPI](<../Docs/[MayDay] openapi.yaml>).

## Quy tắc dữ liệu

- Tìm bệnh nhân cần `phone` và/hoặc `full_name`. `phone` khớp đầu chuỗi, tên khớp chứa, không phân biệt hoa thường. Kết quả được phân trang, tối đa 100 bản ghi mỗi trang.
- Tạo tài khoản băm mật khẩu bằng bcrypt, không trả password/hash/OTP. Tạo bệnh nhân hoặc nhân viên và hồ sơ liên quan trong cùng transaction. Tài khoản nhân viên phải gắn khoa thuộc chi nhánh, phòng thuộc khoa; FK ghép trong database kiểm tra quan hệ này.
- Không tự khoá, tự xoá hoặc tự đổi vai trò. Không xoá/hạ quyền admin hoạt động cuối cùng. Không chuyển qua lại giữa loại tài khoản bệnh nhân và nhân viên để tránh làm sai hồ sơ và bệnh án lịch sử.
- Vai trò kế thừa quyền của vai trò cha. Chặn chu trình cha-con và bảo vệ tên/việc xoá ba vai trò mặc định `admin`, `doctor`, `patient`.
- Quyền gán qua RBAC quyết định quyền vào từng API. Riêng thao tác lâm sàng vẫn kiểm tra bác sĩ phụ trách hoặc bệnh nhân sở hữu bệnh án; admin có thể đọc theo quyền được cấp.
- Mẫu phiếu trả cấu trúc lồng section → question → option, sắp theo `order`. API ánh xạ `order` sang cột `sort_order`. `show_if_answer` nhận/trả chuỗi JSON theo contract. Khi cập nhật `options`, có `id` thì sửa lựa chọn thuộc đúng câu hỏi; không có `id` thì thêm, không xoá các lựa chọn khác.
- Mẫu đã có bệnh án không được xoá (`409 / 4105`). Cũng không cho thay đổi cấu trúc section/question để giữ nguyên nội dung lịch sử; tạo mã mẫu mới khi đổi cấu trúc. Vẫn được sửa metadata như tên, mô tả, version, trạng thái hoạt động.
- Kê đơn/chỉ định/nhập kết quả chỉ được ghi ở bệnh án `in_progress`. Bệnh án đã hoàn tất trả `409 / 4003`. Mỗi bệnh án có tối đa một đơn (`409 / 8003`), kể cả khi hai request gửi đồng thời.
- Kết quả xét nghiệm phải thuộc phiếu được chỉ định; toàn bộ batch rollback nếu có item sai. Upsert kết quả cập nhật `concluded_by`; có một phần kết quả thì `in_progress`, đủ toàn bộ thì `completed`.
- Các ID trong đơn thuốc và xét nghiệm được trả dưới dạng chuỗi theo OpenAPI. API quản trị dùng ID số; `id` ánh xạ từ PK của từng bảng.
- Tham số SQL được bind; tên bảng/cột chỉ lấy từ cấu hình nội bộ. Lỗi FK/check trả `2003`, trùng dữ liệu trả `2009`, trùng số điện thoại trả `3006`, trùng mã mẫu trả `4102`.

## Chạy và kiểm tra

Không cần migration mới: dùng các bảng và endpoint/quyền đã có trong [schema](../Database/000_RelationshipTable.sql) và [seed](../Database/001_Seed_RBAC.sql). Database cũ vẫn cần migration email khôi phục đã ghi trong [README](./README.md). Database thiếu seed RBAC sẽ bị guard từ chối request; không bỏ guard để tránh lỗi này.

Trong thư mục backend:

```powershell
npm ci
npm run build
npm run lint
npm test
npm run test:e2e
```

Khi chạy API bằng npm, `DATABASE_URL` cần trỏ đúng cổng và credentials PostgreSQL thực tế.

Cập nhật container local sau khi sửa source:

```powershell
docker compose up --build -d --no-deps api
```

CORS development cho phép localhost/127.0.0.1 và IPv4 LAN riêng trên cổng 8081, 5173 và 4173. Origin khác và production khai báo bằng `CORS_ORIGINS`; web local có thể tiếp tục dùng Vite proxy.

## Phần chưa nằm trong thay đổi này

Frontend web đã có form, danh sách và API client cho bảy nhóm nghiệp vụ trên; xem [hướng dẫn frontend](../web/README.md). Các luồng mobile tạo/chốt bệnh án, trả lời phiếu, upload ảnh, đợt tổn thương và UAS7 đã được bổ sung trong `src/patient-care/`; xem [hướng dẫn mobile](../mobile/README.md). Migration 003 cung cấp hai phiếu mề đay, định hướng bằng thời gian khởi phát; bác sĩ xác nhận chẩn đoán. Migration 004 tách trạng thái theo dõi tại nhà (followup_active) khỏi việc chốt lượt khám. UAS7 đủ 7 ngày mới diễn giải mức độ. API vị trí/ảnh tổn thương chi tiết chưa có giao diện mobile và chưa nằm trong lần bổ sung này. Danh sách/chi tiết/tóm tắt/tiếp nhận bệnh án đã có trước vẫn giữ nguyên.
