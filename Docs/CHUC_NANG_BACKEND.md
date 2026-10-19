# Các chức năng backend May Day cần triển khai

Chi tiết request, response, quyền và mã lỗi luôn xem trong [OpenAPI](<[MayDay] openapi.yaml>); cấu trúc dữ liệu xem hai file SQL trong `Database/`. Tiến độ công việc được theo dõi trên bảng việc của nhóm.

Backend phục vụ cùng một dữ liệu cho mobile của bệnh nhân/nhân viên và web của nhân viên/admin.

Bản demo đầu tiên có ba role mặc định `admin`, `doctor`, `patient`; Staff là nhóm actor rộng hơn `doctor`, quyền của các role nhân viên khác sẽ do Admin cấu hình bằng RBAC khi được đưa vào phạm vi.

## 1. Nền tảng chung

- Đọc và kiểm tra cấu hình chạy từ biến môi trường: cổng API, PostgreSQL, MinIO, JWT. Không lưu secret thật trong Git.
- Dựng API, PostgreSQL và MinIO để cả nhóm chạy local bằng Docker Compose; khởi tạo schema và seed role/quyền có thể lặp lại.
- Mọi API nghiệp vụ dùng prefix `/api/v1`, response và mã lỗi theo OpenAPI. Kiểm tra dữ liệu đầu vào, phân trang, token và quyền truy cập một cách nhất quán.
- RBAC tra quyền theo HTTP method + path trong DB; ngoài quyền gọi endpoint còn phải kiểm tra quyền sở hữu dữ liệu (bệnh nhân của chính mình, bác sĩ được phân công).

## 2. Tài khoản và hồ sơ cá nhân

- Bệnh nhân đăng ký; mọi người đăng nhập/đăng xuất, đổi mật khẩu, quên/đặt lại mật khẩu qua OTP. Bản demo dùng OTP mock ở môi trường development theo OpenAPI, không gửi SMS thật.
- JWT phải bị từ chối khi hết hạn, đăng xuất, tài khoản bị khóa hoặc mật khẩu đã đổi. Mật khẩu và OTP chỉ lưu dạng hash.
- `GET/PUT /profile` trả và cập nhật đúng hồ sơ của người đang đăng nhập; thông tin bệnh nhân và nhân viên khác nhau.
- Mốc tích hợp đầu tiên: mobile/web đăng nhập bằng tài khoản trong DB rồi xem được hồ sơ thật, không dùng dữ liệu hard-code trong app.

## 3. Quản trị và cơ sở khám

- Admin quản lý tài khoản, tạo nhân viên và phân công chi nhánh/khoa/phòng.
- Admin tạo/sửa/xóa role, permission và ánh xạ role–permission–API endpoint. Mọi thay đổi quyền phải được áp dụng khi gọi API.
- Quản lý chi nhánh, khoa và phòng; khi xóa hoặc chuyển nhân viên phải tuân thủ ràng buộc quan hệ trong SQL/OpenAPI.
- Nhân viên có quyền phù hợp tìm kiếm bệnh nhân và tạo hồ sơ bệnh nhân khi cần.

## 4. Mẫu phiếu và bệnh án

- Admin thiết kế template, section, question, option và logic rẽ nhánh; mobile/web lấy mẫu để hiển thị phiếu khám.
- Bệnh nhân hoặc bác sĩ trả lời câu hỏi phân loại để chọn template, tạo bệnh án và lưu câu trả lời. Câu trả lời phải thuộc đúng mẫu và đúng phần người được phép điền.
- Bác sĩ xem danh sách bệnh án chờ, tiếp nhận, xem tóm tắt/lịch sử và hoàn tất bệnh án. Trạng thái đi theo `pending → in_progress → completed`; bệnh án đã hoàn tất bị khóa theo OpenAPI.
- Bệnh nhân chỉ xem bệnh án/lịch sử của mình; bác sĩ chỉ thao tác bệnh án được phân công. Admin xóa bệnh án theo ràng buộc đã quy định.

## 5. Ảnh và theo dõi tổn thương

- Upload ảnh vào MinIO, metadata vào PostgreSQL; kiểm tra định dạng, tối đa 5 MB/ảnh và 10 ảnh/lần. Chỉ người có quyền mới xem/xóa hoặc gắn ảnh với câu trả lời.
- Bệnh nhân ghi đợt tổn thương, vị trí, ảnh theo mốc và điểm triệu chứng; bác sĩ có quyền xem dữ liệu liên quan đến bệnh án.
- Bệnh nhân chấm UAS7 hằng ngày khi đủ điều kiện. `iss7` là điểm ngứa, `hss7` là điểm số lượng mề đay, mỗi điểm 0–3; backend tính điểm ngày và tổng tuần, ngăn ghi trùng ngày.

## 6. Đơn thuốc và xét nghiệm

- Bác sĩ phụ trách tạo đơn thuốc, chỉ định xét nghiệm và nhập kết quả theo bệnh án. Kiểm tra dữ liệu bắt buộc, trạng thái và quyền thao tác.
- Bệnh nhân xem đơn thuốc và kết quả xét nghiệm của chính mình.

## 7. Kiểm thử và bàn giao

- Mỗi nhóm API có test cho luồng đúng, dữ liệu sai, sai quyền, truy cập chéo và các mã lỗi quan trọng trong OpenAPI.
- Chạy thử kịch bản liền mạch admin → bệnh nhân → bác sĩ → bệnh nhân bằng mobile/web gọi API thật.
- Bàn giao lệnh chạy, seed demo, tài khoản thử và hướng dẫn xử lý lỗi local. Người không viết backend phải tự dựng và chạy được hệ thống.

