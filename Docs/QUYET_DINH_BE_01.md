# BE-01 — Những điều cần chốt trước khi viết backend

Trạng thái: **đã chốt role demo và framework; còn chờ phân công, quy trình xử lý mâu thuẫn tài liệu**. Tài liệu này ghi lại cách hiểu chung, không thay thế [PRD](<[MayDay] Product Requirements Document.pdf>), [OpenAPI](<[MayDay] openapi.yaml>) hay SQL trong `Database/`.

## Điều đã rõ từ tài liệu chuẩn

- Hệ thống có ba **nhóm actor**: Patient, Staff và Admin. Patient dùng mobile; Staff dùng mobile hoặc web; Admin dùng web.
- Staff là nhóm nhân viên y tế, **không đồng nghĩa với role `doctor`**. Giám đốc, Trưởng khoa, Điều dưỡng, Lễ tân… không có use case riêng trong PRD. Admin tạo/cấu hình role và gán quyền bằng RBAC. Danh sách use case của Staff mô tả phạm vi của nhóm, không mặc nhiên cấp tất cả thao tác cho mọi nhân viên.
- SQL hiện cho mỗi tài khoản một `role_id`; các role được gán permission, rồi permission được gán vào API endpoint. Seed hiện tạo ba role mặc định `admin`, `doctor`, `patient`. `doctor` là một role nhân viên mặc định, không phải định nghĩa của toàn bộ Staff.
- OpenAPI hiện mô tả một số thao tác và quy tắc sở hữu dữ liệu riêng cho bác sĩ. Vì vậy, nếu thêm role nhân viên khác thì phải xét cả quyền gọi API **và** quy tắc nghiệp vụ bên trong API; không chỉ thêm một dòng vào bảng `roles`.
- PRD đặt môi trường demo local với PostgreSQL, MinIO và Docker Compose. OpenAPI đặt base path `/api/v1` và quy định OTP giả lập chỉ ở môi trường development; chưa yêu cầu tích hợp SMS thật cho bản demo.

## Quyết định đã chốt cho bản demo đầu tiên

Dùng ba role đã có trong seed: `admin`, `doctor`, `patient`. Các chức danh Staff khác chưa tạo tài khoản demo trong phạm vi hiện tại. Thiết kế RBAC vẫn phải cho phép Admin bổ sung role/quyền về sau. Nếu phạm vi demo thay đổi và thêm loại nhân viên, phải ghi rõ họ được làm việc gì, kiểm tra lại OpenAPI và cập nhật seed/test tương ứng.

Backend dùng **NestJS**. PRD nêu JavaScript/Express.js như công nghệ đề xuất, không bắt buộc framework cụ thể.

## Cần người phụ trách xác nhận

- [x] Bản demo đầu tiên dùng ba role trong seed: `admin`, `doctor`, `patient`.
- [x] Backend dùng NestJS.
- [ ] Ai phụ trách mobile: ______; web: ______; ai cùng kiểm tra buổi ghép đăng nhập/API: ______.
- [ ] Khi PRD, OpenAPI và SQL mâu thuẫn, ai ra quyết định và cập nhật tài liệu liên quan? Người chịu trách nhiệm: ______.

Chỉ đánh dấu BE-01 hoàn thành sau khi điền các mục còn lại và những người làm mobile/web đã đọc bản quyết định. BE-02 đã được khởi tạo trong lúc chờ hoàn tất phân công; commit phần BE-01 riêng khi đủ thông tin.
