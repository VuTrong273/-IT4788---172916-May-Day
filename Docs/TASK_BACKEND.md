# Việc backend cần làm

Tài liệu này là danh sách việc để nhận từng task và commit riêng. Nguồn yêu cầu là PRD, OpenAPI và hai file SQL trong `Docs/`, `Database/`. Nếu checklist này khác tài liệu chuẩn, đối chiếu lại tài liệu chuẩn và ghi quyết định của nhóm trước khi code.

Hiện repo chưa có backend. Các tên lệnh/commit bên dưới tạm giả định dùng NestJS; nếu nhóm chọn framework khác thì giữ nguyên đầu ra cần đạt, chỉ đổi cách triển khai. Không cần làm hết một lần: hoàn thành và kiểm tra từng ô rồi mới nhận ô tiếp theo.

## Cách làm một task

1. Đọc endpoint, schema và mã lỗi liên quan trong `[MayDay] openapi.yaml`; xem bảng liên quan trong `Database/000_RelationshipTable.sql`.
2. Viết code và test cho đúng phạm vi task. Không sửa API/DB trái hợp đồng mà chưa báo mobile, web và người phụ trách tài liệu.
3. Chạy test, thử request thật, cập nhật hướng dẫn nếu cách chạy thay đổi.
4. Chỉ đưa file của task vào commit. Dùng `git status` và `git diff --staged` để kiểm tra trước khi commit. Không commit `.env`, mật khẩu thật, token hay dữ liệu bệnh nhân thật.

Mỗi task có gợi ý tên commit. Đó là **một commit khi task đã chạy và được kiểm tra**, không phải cứ tạo file là commit. Nếu task quá lớn, tách thành các commit nhỏ cùng chủ đề nhưng giữ cùng mã task trong mô tả PR/bảng việc.

## A. Dựng nền — làm trước khi nối app

- [ ] **BE-01 — Chốt các quyết định còn thiếu.** Dùng `Docs/QUYET_DINH_BE_01.md` để ghi cách hiểu Staff/RBAC theo PRD, phạm vi role demo, stack backend, người phụ trách và cách xử lý khi PRD/OpenAPI/SQL không khớp. Nhóm mobile/web cùng xác nhận; chỉ tích ô này sau khi các mục chờ xác nhận đã được giải quyết. Commit: `docs(backend): chot quyet dinh ky thuat`.
- [ ] **BE-02 — Tạo dự án backend.** Tạo `backend/`, cấu trúc module, script chạy/test/lint và `.gitignore`; chạy server lên được trên máy mới. Chưa cần DB hay đăng nhập. Commit: `chore(backend): khoi tao du an`.
- [ ] **BE-03 — Cấu hình môi trường.** Đọc port, URL PostgreSQL, MinIO và JWT secret từ biến môi trường; có `.env.example`, kiểm tra thiếu cấu hình khi khởi động. Không đưa secret thật vào Git. Commit: `chore(backend): them cau hinh moi truong`.
- [ ] **BE-04 — Docker Compose cho local.** Chạy được PostgreSQL, MinIO và API; có healthcheck, volume phù hợp và hướng dẫn lệnh chạy/dừng. Máy khác làm theo README cũng mở được API. Commit: `chore(backend): them docker compose local`.
- [ ] **BE-05 — Khởi tạo schema và seed.** Áp dụng `000_RelationshipTable.sql` và `001_Seed_RBAC.sql` bằng một quy trình chạy lại được; kiểm tra bảng, khóa ngoại, role và permission. Tài khoản admin trong seed chỉ dùng ở môi trường demo. Commit: `feat(backend): khoi tao database va seed rbac`.
- [ ] **BE-06 — Quy ước API chung.** Dùng prefix `/api/v1`, response `{code, message, data}`, validate input và ánh xạ HTTP status/mã lỗi theo OpenAPI. Có test cho lỗi validate và lỗi server; không trả stack trace cho client. Commit: `feat(backend): chuan hoa response va loi api`.

**Mốc A:** một thành viên khác chạy backend + PostgreSQL + MinIO từ hướng dẫn, gọi API thử và thấy schema/seed đã sẵn sàng.

## B. Đăng nhập thật — mốc để mobile và web tích hợp

- [ ] **BE-07 — Đăng nhập.** `POST /auth/login` kiểm tra SĐT, mật khẩu hash và `is_active`, trả JWT và `user_info` đúng OpenAPI. Test mật khẩu sai, số điện thoại không tồn tại và tài khoản bị khóa. Commit: `feat(auth): dang nhap bang so dien thoai`.
- [ ] **BE-08 — Xác thực token và hồ sơ cá nhân.** Middleware/guard đọc JWT; `GET /profile` chỉ trả thông tin của chính người dùng, đúng dữ liệu bệnh nhân hoặc nhân viên. Test thiếu/hết hạn/sai token. Commit: `feat(profile): doc ho so tu token`.
- [ ] **BE-09 — Mobile/web kết nối luồng đầu tiên.** Cung cấp URL có thể truy cập từ điện thoại thật (không dùng `localhost` trên điện thoại), tài khoản test và ví dụ request/response. Cùng người làm mobile/web thử đăng nhập và xem hồ sơ bằng API thật; ghi kết quả thử vào tài liệu, lỗi phát hiện thành task riêng. Commit: `docs(backend): ghi ket qua tich hop dang nhap` (nếu phải sửa code, commit sửa lỗi riêng).
- [ ] **BE-10 — Các thao tác tài khoản còn lại.** Làm `POST /auth/signup`, `POST /auth/logout`, `PUT /auth/change-password`, `PUT /profile`; sau đó OTP mock cho `forgot-password` và `reset-password` theo OpenAPI. Token/logout, giới hạn OTP và dữ liệu nhạy cảm phải có test. Có thể tách thành 2–3 commit theo từng nhóm endpoint. Commit mẫu: `feat(auth): dang ky va quan ly phien`.

**Mốc B:** app trên điện thoại và web đăng nhập bằng tài khoản trong DB, mở lại vẫn xác thực được; token sai/hết hạn bị từ chối. Không coi tài khoản demo hard-code trong app là đã tích hợp.

## C. Quyền và dữ liệu nền

- [ ] **BE-11 — RBAC động.** Dùng `roles`, `permissions`, `api_endpoints`, các bảng ánh xạ và seed để kiểm tra quyền theo method/path; API công khai không cần token. Test admin/doctor/patient gọi sai quyền. Commit: `feat(rbac): kiem tra quyen theo endpoint`.
- [ ] **BE-12 — Quản trị user/role/permission.** Các endpoint `/admin/users`, `/auth/admin/create-staff`, `/roles`, `/permissions` và các endpoint ánh xạ role–permission, permission–endpoint, API endpoint trong OpenAPI. Chia commit theo cụm CRUD; test chỉ admin được sửa. Commit mẫu: `feat(admin): quan ly nguoi dung`.
- [ ] **BE-13 — Cơ sở khám.** CRUD `/branches`, `/departments`, `/rooms`; validate quan hệ cha–con, quyền và trường hợp xóa dữ liệu đang được tham chiếu. Commit: `feat(org): quan ly co so va phong kham`.
- [ ] **BE-14 — Bác sĩ tra cứu bệnh nhân.** `/doctor/patients/search` và `/doctor/patients`; kiểm tra quyền, dữ liệu trùng và tiêu chí tìm kiếm trong PRD. Commit: `feat(doctor): tra cuu va tao benh nhan`.

## D. Luồng bệnh án chính

- [ ] **BE-15 — Mẫu phiếu khám.** `/templates` cùng section, question, option; trả cấu trúc form cho mobile/web và kiểm soát thay đổi mẫu đã được dùng. Chia commit theo template và thành phần con. Commit mẫu: `feat(templates): quan ly mau phieu kham`.
- [ ] **BE-16 — Phân loại và tạo bệnh án.** `/medical_records/classify-questions`, `/medical_records/classify`, tạo và xem bệnh án; chỉ lấy đúng dữ liệu bệnh nhân. Test đầu vào và việc chọn mẫu phiếu theo hợp đồng API. Commit: `feat(records): phan loai va tao benh an`.
- [ ] **BE-17 — Trả lời phiếu.** API answers của bệnh án, lưu câu trả lời theo loại câu hỏi, kiểm tra câu hỏi thuộc mẫu đang dùng và quyền sửa. Commit: `feat(records): luu cau tra loi phieu kham`.
- [ ] **BE-18 — Bác sĩ tiếp nhận và hoàn tất.** Danh sách/chi tiết/tóm tắt/lịch sử bệnh án; luồng `pending → in_progress → completed`; bác sĩ được phân công mới thao tác, bệnh án hoàn tất không được sửa. Test chuyển trạng thái sai và truy cập chéo. Commit: `feat(records): tiep nhan va hoan tat benh an`.

**Mốc D:** bệnh nhân tạo bệnh án trên app, bác sĩ xem/tiếp nhận trên web, bệnh nhân xem lại hồ sơ sau khi hoàn tất.

## E. Ảnh, theo dõi và chỉ định

- [ ] **BE-19 — Lưu ảnh.** Upload/xem/xóa `/image-attachments`, upload nhiều ảnh theo giới hạn trong PRD; file ở MinIO, metadata trong PostgreSQL. Kiểm tra loại file, kích thước, quyền truy cập và dọn dữ liệu khi upload thất bại. Commit: `feat(media): luu anh tren minio`.
- [ ] **BE-20 — Ảnh cho câu trả lời.** `/answer-images`; chỉ gắn ảnh thuộc người dùng/bệnh án hợp lệ, kiểm tra quyền xem và xóa. Commit: `feat(records): gan anh vao cau tra loi`.
- [ ] **BE-21 — Đợt tổn thương.** `/lesion-episodes`, `/lesion-locations`, `/lesion-photos`; test liên kết episode–location–photo và quyền bệnh nhân/bác sĩ. Có thể tách 2–3 commit. Commit mẫu: `feat(lesions): quan ly dot ton thuong`.
- [ ] **BE-22 — UAS7.** Eligibility, ghi điểm và tổng hợp tuần theo `/uas7-scores`; test thang 0–3 cho từng thành phần, ngày trùng và quyền xem theo bệnh nhân. Commit: `feat(uas7): ghi va tong hop diem`.
- [ ] **BE-23 — Đơn thuốc và xét nghiệm.** `/prescriptions`, `/lab-requests`, `/lab-results`; kiểm tra bệnh án, bác sĩ được phân công, trạng thái và dữ liệu bắt buộc. Có thể tách từng module thành một commit. Commit mẫu: `feat(prescriptions): quan ly don thuoc`.

## F. Kiểm thử và bàn giao

- [ ] **BE-24 — Rà soát hợp đồng API.** Đối chiếu toàn bộ operation trong OpenAPI với code: endpoint nào xong, endpoint nào chưa, request/response/mã lỗi/quyền có khớp không. Lỗi phát hiện được sửa bằng commit ở module tương ứng. Commit: `test(backend): bo sung kiem thu hop dong api`.
- [ ] **BE-25 — Kiểm thử luồng chung.** Chạy kịch bản admin → bệnh nhân → bác sĩ → bệnh nhân với mobile/web; kiểm tra dữ liệu chéo, ảnh, UAS7, đơn thuốc/xét nghiệm, lỗi mạng và token. Ghi kết quả cùng vấn đề còn mở. Commit: `test(backend): kiem thu luong demo`.
- [ ] **BE-26 — Bàn giao chạy local.** README có yêu cầu môi trường, lệnh chạy Compose, seed, tài khoản demo, cách reset **chỉ dữ liệu local**, URL API và cách chạy test. Một người không viết backend làm theo và chạy được. Commit: `docs(backend): huong dan chay va demo`.

## Đừng quên khi chia việc

Các task BE-01 đến BE-08 nên làm đúng thứ tự. Từ BE-11 trở đi có thể chia người làm song song, nhưng phải chốt giao diện module và bảng dữ liệu trước. BE-09 là buổi tích hợp với mobile/web, không phải một task chỉ của backend. BE-24 không thay cho việc viết test ở từng task.
