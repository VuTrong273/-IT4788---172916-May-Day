# Đối chiếu triển khai May Day — 17/11/2026

## Phần đã triển khai

| Yêu cầu | Kết quả |
| --- | --- |
| Vị trí tổn thương | API tạo/xem/sửa/xóa; mobile thêm, đổi tên, xóa trong chi tiết đợt. Xóa vị trí xóa các mốc ảnh liên quan; file gốc còn trong thư viện. |
| Ảnh theo mốc | Khởi phát (`start`), nặng nhất (`peak`), trở lại bình thường (`normal`); gắn toàn đợt hoặc một vị trí; ngứa/đau/rát 0–10, số sẩn phù không âm. Mobile ghi, bác sĩ web/mobile xem theo bệnh án. |
| Web khám bệnh | Nhận bệnh án, đọc phần bệnh nhân, điền phần bác sĩ/cả hai, câu hỏi điều kiện, lưu phiếu và ảnh, hoàn tất cùng lời dặn; phiếu đã hoàn tất chỉ đọc. |
| Theo dõi sau khám | `followup_active` độc lập với `status`. Bác sĩ phụ trách đóng/mở theo dõi. Đóng chặn ghi/sửa/xóa nhật ký và chấm UAS7; dữ liệu cũ vẫn xem được. |
| UAS7 trên web | Xem điểm ngày và tổng 7 ngày theo bệnh nhân; chọn ngày bắt đầu tuần. Chỉ diễn giải mức độ khi đủ 7 ngày. |
| Quản trị bệnh án | Web có thao tác xóa kèm xác nhận; API vẫn kiểm tra quyền quản trị. |
| Hồ sơ nhân viên | Web cập nhật họ tên và giới tính. |
| Vai trò tùy chỉnh | `actor_type` chọn luồng khám/quản trị, hoặc phân giải từ vai trò cha. Login/profile trả `base_role`; mobile/web nhận diện qua dữ liệu máy chủ. Quyền endpoint và sở hữu bệnh án kiểm tra ở backend mỗi request. |
| Chọn mẫu theo cấu hình | `templates.intake_duration`: `lt6w`, `gte6w` hoặc NULL. Chỉ một mẫu hoạt động/nhóm; mẫu phải có câu hỏi để xuất hiện trong phân loại. Hai giao diện quản trị chỉnh được cấu hình. |

Vai trò độc lập cần được gán quyền API cần thiết, bao gồm hồ sơ cá nhân và các API đọc mà màn hình gọi. Chọn luồng không cấp quyền API. Vai trò cha cộng thêm quyền kế thừa. Sau khi đổi vai trò tài khoản, đăng nhập lại để cập nhật điều hướng; máy chủ áp dụng quyền hiện tại ngay.

Để thay mẫu tự động: bỏ ánh xạ hoặc ngừng mẫu cũ, hoàn thiện mẫu mới, rồi gán nhóm thời gian và kích hoạt mẫu mới. Mẫu đã có bệnh án không được sửa cấu trúc câu hỏi lịch sử.

## Kiểm chứng

- Router NestJS chạy thật: đủ **106/106 route** trong OpenAPI. Con số này chỉ chứng minh route đã đăng ký.
- HTTP với PostgreSQL/MinIO thật trong schema/bucket riêng: truy cập chéo, sai điểm, sai vị trí/đợt, đóng theo dõi, xóa liên đới, URL ảnh có chữ ký, vai trò kế thừa, vai trò không có quyền, cấu hình mẫu trùng và đổi mẫu.
- Lượt kiểm tra hoàn tất đạt **72 bước tích hợp/giao diện**. Test thường trực đạt 79 backend, 11 HTTP với repository giả, 70 mobile và inventory 106 operation. Android/Web export, typecheck và lint đã chạy; lint mobile còn một cảnh báo axios có sẵn, không có lỗi.
- Playwright trên Edge: bác sĩ có vai trò tùy chỉnh lưu phiếu, tải lại giữ nội dung, upload/gắn ảnh, hoàn tất khóa phiếu và ngừng theo dõi được lưu xuống DB.
- Expo Web ở kích thước màn hình điện thoại: bệnh nhân mở nhật ký, thêm/chọn vị trí, chọn file ảnh, lưu điểm ngứa và đổi mốc ảnh; đối chiếu dữ liệu lưu trong PostgreSQL. Request chuyển tới API thật trong schema riêng, không giả lập response nghiệp vụ.
- Bộ test backend/mobile, build web, kiểm tra kiểu, lint và export Expo Android/Web chạy trước bàn giao. Script tích hợp tạm và schema/bucket thử được dọn sau khi dùng.
- Tìm kiếm 10.000 bệnh nhân thử, 10 request liên tiếp local: lượt đầu trung vị **37,7 ms**, chậm nhất **49,0 ms**; lượt cuối khi máy đồng thời xử lý giao diện/build trung vị **270,4 ms**, chậm nhất **677,2 ms**. Các lượt đều dưới 1 giây/request, không đại diện tải đồng thời hoặc độ trễ production.

Không coi bảng inventory `planned` trong mobile là bằng chứng hoàn thành. Kết quả cuối cùng đọc cùng báo cáo bàn giao.

## Khác biệt so với PDF gốc

PDF PRD/use case/class/ER là thiết kế ban đầu. Những quyết định triển khai sau này được thể hiện trong mã nguồn và OpenAPI:

- OTP email đã xác minh thay cho SMS.
- Phân nhóm thời gian khởi phát chọn phiếu; bác sĩ xác nhận chẩn đoán. Mục phạm vi PDF về phân loại 6 tuần khác hợp đồng OpenAPI hiện dùng.
- Hoàn tất lượt khám khóa phiếu; theo dõi tại nhà chỉ khóa khi bác sĩ đóng riêng.
- UAS7: 0 không hoạt động; 1–6 kiểm soát tốt; 7–15 nhẹ; 16–27 vừa; 28–42 nặng; thiếu ngày không diễn giải.
- Quy định xóa tài khoản trong PDF khác OpenAPI; backend áp dụng ràng buộc dữ liệu tham chiếu và giữ ít nhất một quản trị viên hoạt động.

Nghiệm thu dùng OpenAPI hiện hành cùng tài liệu này để giải thích khác biệt. Các PDF chưa được viết lại. AI nhận diện ảnh, chú thích ảnh, FCM, HIS, xuất Excel/PDF và thang đo chuyên sâu vẫn ngoài phạm vi.

## Còn cần nghiệm thu môi trường

- Chọn ảnh, quyền truy cập ảnh, LAN và luồng nghiệp vụ trên điện thoại Android/iOS thật.
- OTP email: người dùng xác nhận đã kiểm tra thành công ngày 20/11/2026. Khi chuyển môi trường bàn giao, cần giữ cấu hình SMTP phù hợp.
- Tải đồng thời, phục hồi lỗi và vận hành dài hạn; chưa có bằng chứng uptime 99%.

## Cập nhật DB đang dùng

Áp dụng [migration 005](../Database/migrations/005_dynamic_roles_and_intake.sql) bằng tài khoản sở hữu DB trước khi chạy backend mới. Migration thêm cột/hàm, không sửa/xóa tài khoản hoặc bệnh án. Compose chỉ tự chạy SQL khởi tạo khi volume DB mới. Không xóa volume để cập nhật hệ thống đang dùng.

## Phân quyền giao diện web/mobile — 20/11/2026

- Bổ sung `GET /api/v1/auth/access`: tài khoản đã xác thực đọc quyền hiệu lực của chính mình, gồm quyền kế thừa và danh mục route. Không cần cấp quyền đọc profile hoặc quản trị RBAC để sử dụng API này; tài khoản khóa/token không hợp lệ vẫn bị từ chối.
- Web và mobile kiểm tra quyền endpoint để hiển thị menu, mở trang và thao tác tạo/sửa/xóa/gán quyền, phiếu khám, xét nghiệm, đơn thuốc, ảnh và theo dõi. Vai trò nghiệp vụ vẫn quyết định điều kiện sở hữu/phân công và trạng thái bệnh án; backend kiểm tra mỗi request.
- Quyền đọc route tham số không tự cấp quyền route tĩnh: xem một bệnh án không đồng nghĩa được xem `/medical_records/all`. Khi chưa tải được quyền, chức năng được khóa và có thông báo thử lại.
- Web tải lại quyền khi cửa sổ được focus; mobile khi màn hình được focus; cả hai cập nhật định kỳ 60 giây và tải lại khi backend trả mã thiếu quyền 3101. Backend áp dụng thay đổi ngay, giao diện cập nhật ở lần tải quyền tiếp theo.
- Vai trò tùy chỉnh: chọn luồng `doctor` hoặc `admin`, gán quyền phù hợp. Ví dụ Điều dưỡng có quyền đọc bệnh án/xét nghiệm sẽ thấy màn hình tương ứng; cấp thêm quyền ghi kết quả mới hiện thao tác ghi. Chọn vai trò cha sẽ kế thừa quyền cha, không phù hợp nếu cần hạn chế quyền của vai trò đó.
- Kiểm tra: backend 84 unit test, 11 HTTP test; mobile 73 test; kiểm tra inventory 107 thao tác OpenAPI; build web, typecheck/lint mobile và export Android/Web thành công. 23 kiểm tra bổ sung trên API thật và Edge (web + bản web của mobile) xác nhận quyền hạn chế, route bị chặn và thu hồi quyền. Dữ liệu thử dùng schema riêng và đã dọn.
- [Migration 006](../Database/migrations/006_self_access.sql) đã áp dụng trên DB local; container API đã cập nhật. API mới trả HTTP 200; đối chiếu trước/sau giữ nguyên toàn bộ 5 tài khoản, bao gồm hash mật khẩu. Không thay đổi dữ liệu bệnh án đang dùng. Android/iOS trên thiết bị thật vẫn cần kiểm tra thủ công.

Máy local đã áp dụng migration và cập nhật container API. Kiểm tra trước/sau xác nhận giữ nguyên 5 tài khoản, gồm hash mật khẩu; bệnh án/đợt/vị trí/ảnh theo mốc/UAS7 trong DB chính vẫn trống sau lần dọn dữ liệu trước. Migration chạy lại không khôi phục ánh xạ mẫu mà admin đã chủ động bỏ.

## Kiểm tra bổ sung ngày 20/11/2026

- Gom cấu hình pool PostgreSQL dùng chung cho ba lớp truy cập DB và xử lý sự kiện lỗi kết nối nền. PostgreSQL tự loại kết nối hỏng; tiến trình tiếp tục chạy và kết nối mới được tạo khi có yêu cầu tiếp theo. Log không chứa thông báo lỗi gốc hoặc thông tin xác thực.
- Khi rollback của `DatabaseService` thất bại, loại kết nối khỏi pool thay vì tái sử dụng.
- Kiểm tra thật bằng `pg_terminate_backend` trên đúng PID của từng kết nối thử: cả ba pool phục hồi, PID thay đổi, truy vấn tiếp theo thành công; hash toàn bộ tài khoản trước/sau không đổi. Không restart DB và không tạo bệnh án thử.
- Backend đạt 80 unit test, 11 HTTP test; build và lint thành công. Thêm test hồi quy cho lỗi kết nối nền lặp lại và tránh ghi thông tin xác thực vào log.
- Backend trả HTTP 200 tại localhost và IP Wi-Fi `192.168.100.207:3000`. Cấu hình mobile local đã đúng IP này. Địa chỉ LAN có thể đổi khi chuyển mạng; lệnh `npm start` tự chọn IP hiện tại.
- Tại thời điểm kiểm tra tự động, môi trường local chưa cấu hình `GMAIL_USER` và `GMAIL_APP_PASSWORD`; công cụ không gửi email. Sau đó người dùng xác nhận đã tự kiểm tra chức năng OTP email thành công ngày 20/11/2026. Ghi nhận OTP email đã đạt kiểm tra thủ công của người dùng; không suy ra cấu hình SMTP hiện tại của container đã thay đổi hoặc mọi trường hợp lỗi OTP đã được kiểm thử.
- Kiểm tra Android/iOS thật và uptime dài hạn vẫn chưa hoàn tất. Kiểm tra kết nối nền bị ngắt không thay thế kiểm thử gián đoạn giữa giao dịch hoặc toàn bộ hạ tầng mất điện.
