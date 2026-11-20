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
| Bệnh án | Vòng đời `pending → in_progress → completed`; bác sĩ nhận trước khi thao tác; hoàn tất khóa phiếu; theo dõi tại nhà có trạng thái riêng | `/medical_records`, `/medical_records/{id}/answers`, `/templates/{id}` | Đã có xem, tiếp nhận, phiếu động theo điều kiện, lưu câu trả lời và ảnh, hoàn tất, đóng/mở theo dõi; admin xóa có xác nhận. |
| Bệnh nhân | Bác sĩ tìm kiếm hoặc tạo hồ sơ; chỉ hiện dữ liệu có quyền | `GET /doctor/patients/search`, `POST /doctor/patients` | Đã có tìm kiếm, tạo và xem hồ sơ. |
| Tài khoản | Admin quản lý trạng thái/vai trò và gán nhân viên vào chi nhánh/khoa/phòng | `/admin/users`, `/admin/users/{id}`, `/admin/users/{id}/assign` | Đã có danh sách/phân trang/lọc, tạo/sửa/xóa, tạo nhân viên và phân công. |
| Cơ sở khám | Cấu trúc chi nhánh → khoa → phòng; ràng buộc xoá theo quan hệ | `/branches`, `/departments`, `/rooms` | Đã có quản lý cả ba cấp, lọc theo cấp cha và xác nhận xóa. |
| Mẫu phiếu | Mẫu → section → question → option; mẫu đang được dùng không được xoá | `/templates`, `/templates/{id}`, `/templates/{template_id}/sections`, `/templates/sections/{id}`, `/templates/sections/{section_id}/questions`, `/templates/questions/{id}` | Đã có danh sách và trình thiết kế phần/câu hỏi/lựa chọn, điều kiện hiển thị theo câu trả lời cha. |
| Phân quyền | Role → permission → API endpoint; RBAC dùng method + path | `/roles`, `/permissions`, `/role_permissions`, `/api_endpoints`, `/permission_endpoints` | Đã có CRUD danh mục và gán/thu hồi quyền trực tiếp bằng checkbox. |
| Xét nghiệm | Bác sĩ chỉ định và nhập kết quả trong bệnh án | `POST /lab-requests`, `GET /lab-results/{record_id}`, `POST /lab-results` | Đã có chỉ định, nhập/cập nhật kết quả từng phần và xem trạng thái; admin chỉ đọc. |
| Đơn thuốc | Bác sĩ kê đơn theo bệnh án; một bệnh án tối đa một đơn theo mã lỗi đặc tả | `POST /prescriptions`, `GET /prescriptions/{medical_record_id}` | Đã có kê/xem đơn trong phạm vi bệnh án; admin chỉ đọc. |

## Giao diện phân quyền theo chức năng

PRD trang 4–5 yêu cầu quản lý vai trò, quyền, gán quyền cho vai trò và cấu hình quyền truy cập API. Giao diện mặc định cung cấp chọn vai trò và đánh dấu chức năng bằng tiếng Việt, chia nhóm khám bệnh, xét nghiệm, theo dõi, mẫu phiếu, tài khoản và cơ sở khám. Quyền kế thừa hiển thị riêng, chỉ sửa tại vai trò gốc. Quản lý vai trò vẫn cho tạo vai trò tùy chỉnh và chọn luồng làm việc.

Danh mục quyền, danh mục API và ánh xạ quyền–API được giữ trong **Cấu hình nâng cao** để đáp ứng yêu cầu cấu hình hệ thống. Nhãn giao diện không thay đổi mã quyền hoặc các ánh xạ đã lưu. Lưu phân quyền sử dụng các ID hiện có và kiểm tra thay đổi đồng thời trước khi ghi.

## Kiểm tra phạm vi backend hiện có

Backend đã đăng ký đủ 106 route trong OpenAPI; đây là kiểm tra sự hiện diện, không phải tỷ lệ hoàn thành nghiệp vụ. Web đọc nhật ký đợt/vị trí/ảnh theo mốc và UAS7; mobile ghi dữ liệu theo dõi. Vai trò tùy chỉnh dùng `actor_type` hoặc kế thừa vai trò cha để chọn luồng; quyền API vẫn được kiểm tra từ DB mỗi request. Mẫu có `intake_duration` để cấu hình chọn tự động. Xem [biên bản đối chiếu và kiểm chứng](./NGHIEM_THU.md) và [danh mục API](../backend/OPERATIONS_API.md).

## Quy tắc triển khai UI

1. Mỗi feature có thư mục riêng gồm page, component nghiệp vụ, API client và type.
2. Dùng `components/ui` cho thành phần dùng chung; không gộp nghiệp vụ khác nhau vào một trang placeholder.
3. Chỉ hiển thị thao tác mà role trong OpenAPI được phép gọi; backend vẫn là nơi xác thực cuối cùng.
4. Có trạng thái tải, lỗi, rỗng, thành công và trạng thái xung đột nghiệp vụ theo response thực tế.
5. Không dùng dữ liệu mẫu để giả lập đã lưu thành công. API chưa chạy thì ghi rõ “đặc tả có endpoint, runtime chưa được xác nhận”.
6. Không thay đổi source backend/database trong phần việc frontend.
