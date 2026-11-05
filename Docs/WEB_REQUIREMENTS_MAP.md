# Ánh xạ yêu cầu nghiệp vụ sang Web portal

Tài liệu này giúp kiểm tra giao diện web theo tài liệu dự án, thay vì suy luận endpoint từ tên màn hình.

## Tài liệu nguồn

- `[MayDay] Product Requirements Document.pdf`: mục tiêu sản phẩm, người dùng và yêu cầu chức năng.
- `[MayDay] Use Case Diagram.pdf`: tác nhân và các luồng nghiệp vụ.
- `[MayDay] Class Diagram.pdf` và `[MayDay] Entity Relationship Diagram.pdf`: cấu trúc đối tượng và quan hệ dữ liệu.
- `[MayDay] openapi.yaml`: hợp đồng request/response, HTTP method, path và phân quyền API.
- `CHUC_NANG_BACKEND.md`: phạm vi chức năng backend được yêu cầu.

OpenAPI mô tả hợp đồng API dự kiến. Nó không chứng minh API đã có trong backend runtime. Trước khi bật thao tác ghi ở giao diện, phải xác nhận route, DTO/response và quyền thực tế với backend.

## Phân vai trò trên web

| Vai trò | Khu vực web | Nghiệp vụ theo tài liệu |
| --- | --- | --- |
| Bác sĩ | Tổng quan, bệnh án, bệnh nhân, xét nghiệm, đơn thuốc, hồ sơ cá nhân | Tìm/tạo hồ sơ bệnh nhân; nhận bệnh án `pending`; xử lý `in_progress`; chốt `completed`; xem lịch sử, chỉ định và kết quả trong phạm vi được phân công. |
| Quản trị viên | Tổng quan, bệnh án, tài khoản, cơ sở khám, mẫu phiếu, phân quyền, hồ sơ cá nhân | Quản lý tài khoản và phân công; chi nhánh/khoa/phòng; mẫu phiếu; vai trò/quyền/endpoint; xoá bệnh án theo ràng buộc. |
| Bệnh nhân | Không phải đối tượng chính của web desktop | Dùng mobile cho đăng ký, hồ sơ, phiếu khám, ảnh tổn thương và UAS7. Web không nên thêm luồng bệnh nhân riêng nếu PRD/nhóm chưa đổi phạm vi. |

## Luồng và API cần phản ánh trong UI

| Khu vực | Quy tắc nghiệp vụ cần thể hiện | Hợp đồng API liên quan | Tình trạng frontend |
| --- | --- | --- | --- |
| Đăng nhập / bảo mật | JWT; quên mật khẩu bằng email và OTP; đổi mật khẩu làm mất hiệu lực token cũ | `/auth/login`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` | Đã có màn hình và client API trong `features/auth`. |
| Hồ sơ cá nhân | Chỉ đọc/cập nhật hồ sơ tài khoản hiện tại | `GET/PUT /profile` | Đã có trang hồ sơ. |
| Tổng quan | Bệnh án theo trạng thái, liên kết tới hàng đợi; không bịa số liệu | `GET /medical_records/all` | Đọc dữ liệu backend thật. |
| Bệnh án | Vòng đời `pending → in_progress → completed`; bác sĩ nhận trước khi thao tác; hoàn tất thì khoá; admin có thể xoá theo ràng buộc | `GET /medical_records/all`, `GET /medical_records/{id}`, `GET /medical_records/{id}/summary`, `POST /medical_records/{id}/accept`, `PUT /medical_records/{id}`, `DELETE /medical_records/{id}` | Danh sách/chi tiết/nhận bệnh án có; cập nhật câu trả lời và hoàn tất cần được bổ sung theo hợp đồng sau khi xác nhận runtime. |
| Bệnh nhân | Bác sĩ tìm kiếm hoặc tạo hồ sơ; chỉ hiện dữ liệu có quyền | `GET /doctor/patients/search`, `POST /doctor/patients` | Cần xây luồng theo API contract và xác nhận backend runtime. |
| Tài khoản | Admin quản lý trạng thái/vai trò và gán nhân viên vào chi nhánh/khoa/phòng | `/admin/users`, `/admin/users/{id}`, `/admin/users/{id}/assign` | Cần xây sau khi xác nhận runtime. |
| Cơ sở khám | Cấu trúc chi nhánh → khoa → phòng; ràng buộc xoá theo quan hệ | `/branches`, `/departments`, `/rooms` | Cần xây sau khi xác nhận runtime. |
| Mẫu phiếu | Mẫu → section → question → option; mẫu đang được dùng không được xoá | `/templates`, `/templates/{id}`, `/templates/{template_id}/sections`, `/templates/sections/{id}`, `/templates/sections/{section_id}/questions`, `/templates/questions/{id}` | Cần xây sau khi xác nhận runtime. |
| Phân quyền | Role → permission → API endpoint; RBAC dùng method + path | `/roles`, `/permissions`, `/role_permissions`, `/api_endpoints`, `/permission_endpoints` | Cần xây sau khi xác nhận runtime. |
| Xét nghiệm | Bác sĩ chỉ định và nhập kết quả trong bệnh án | `POST /lab-requests`, `GET /lab-results/{record_id}`, `POST /lab-results` | Cần xây sau khi xác nhận runtime. |
| Đơn thuốc | Bác sĩ kê đơn theo bệnh án; một bệnh án tối đa một đơn theo mã lỗi đặc tả | `POST /prescriptions`, `GET /prescriptions/{medical_record_id}` | Cần xây sau khi xác nhận runtime. |

## Kiểm tra phạm vi backend hiện có

Đối chiếu controller trong `backend/src/` cho thấy hiện có route runtime cho auth, profile, và một phần bệnh án: danh sách, chi tiết, tóm tắt, nhận bệnh án. Các module quản trị tài khoản/cơ sở/RBAC/mẫu phiếu/bệnh nhân/xét nghiệm/đơn thuốc chưa thấy controller tương ứng trong source hiện tại. Đây là khoảng trống triển khai backend so với hợp đồng và phải được phối hợp với thành viên backend; frontend không tự tạo endpoint thay họ.

## Quy tắc triển khai UI

1. Mỗi feature có thư mục riêng gồm page, component nghiệp vụ, API client và type.
2. Dùng `components/ui` cho thành phần dùng chung; không gộp nghiệp vụ khác nhau vào một trang placeholder.
3. Chỉ hiển thị thao tác mà role trong OpenAPI được phép gọi; backend vẫn là nơi xác thực cuối cùng.
4. Có trạng thái tải, lỗi, rỗng, thành công và trạng thái xung đột nghiệp vụ theo response thực tế.
5. Không dùng dữ liệu mẫu để giả lập đã lưu thành công. API chưa chạy thì ghi rõ “đặc tả có endpoint, runtime chưa được xác nhận”.
6. Không thay đổi source backend/database trong phần việc frontend.
