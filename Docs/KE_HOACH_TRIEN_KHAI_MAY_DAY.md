# Kế hoạch triển khai May Day

May Day gồm ba phần dùng chung một hệ thống dữ liệu: ứng dụng điện thoại cho bệnh nhân và nhân viên y tế, website cho bác sĩ và quản trị viên, và backend phục vụ cả hai. Phạm vi chức năng lấy từ PRD và OpenAPI trong thư mục `Docs`, không lấy từ bản app demo đang có.

Đích bàn giao của đợt này là **chạy và demo được toàn bộ hệ thống ở môi trường cục bộ**. Backend, PostgreSQL và MinIO được dựng bằng Docker Compose; điện thoại và website kết nối vào cùng API. PRD chưa đặt ngày phát hành và không yêu cầu đưa app lên store trong giai đoạn này.

## Cả nhóm sẽ demo những gì?

Buổi demo cần kể được một câu chuyện liền mạch:

1. Quản trị viên tạo cơ sở, tài khoản nhân viên, quyền và mẫu phiếu khám trên web.
2. Bệnh nhân đăng ký, khai hồ sơ, trả lời câu hỏi phân loại, tạo bệnh án và điền phiếu trên điện thoại. Bệnh nhân có thể gửi ảnh, ghi lại đợt tổn thương và chấm UAS7 khi đủ điều kiện.
3. Bác sĩ xem bệnh án chờ, tiếp nhận, xem câu trả lời/ảnh/diễn biến, bổ sung phần khám, chỉ định xét nghiệm, kê đơn và chốt bệnh án.
4. Bệnh nhân mở lại app để xem lịch sử khám, kết quả và đơn thuốc.

Đây là luồng chính để các phần của nhóm ghép với nhau. Những chức năng khác trong PRD/OpenAPI vẫn phải được liệt kê và kiểm tra; nếu muốn để lại sau buổi demo, trưởng nhóm cần ghi rõ và được cả nhóm đồng ý. Các mục PRD đã loại khỏi phạm vi như AI nhận diện ảnh, thông báo FCM, tích hợp HIS, xuất báo cáo và vẽ lên ảnh thì không giao việc.

## Làm theo thứ tự nào?

### 1. Chốt thiết kế trước khi chia code

Cả nhóm đọc PRD, Use Case Diagram, Class Diagram, ERD và OpenAPI. Trưởng nhóm ghi lại danh sách màn hình, chức năng, API và bảng dữ liệu tương ứng. Sau đó chốt người phụ trách từng phần, cách chạy chung ở máy local và kịch bản demo ở trên. Những điểm tài liệu chưa rõ phải được hỏi và ghi quyết định, không để mobile, web và backend tự đoán khác nhau.

Ở bước này cần đặc biệt chốt: “Staff” trong PRD tương ứng với vai trò `doctor` mặc định của API đến đâu; web của bác sĩ cần những màn nào; OTP trong bản demo dùng mock ra sao; API phân loại chọn mẫu phiếu khác gì với chức năng chẩn đoán y khoa mà PRD loại khỏi phạm vi.

### 2. Dựng phần chung để mọi người bắt đầu làm việc

Backend dựng PostgreSQL, MinIO, API và dữ liệu mẫu bằng Docker Compose. Mobile giữ dự án React Native/Expo hiện có; nhóm web tạo ứng dụng web. Cả hai phía dùng cùng địa chỉ `/api/v1`, cùng cấu trúc request/response trong OpenAPI và cùng tài khoản test. Làm đăng nhập, phân quyền và hồ sơ trước để kiểm tra ba phần thật sự kết nối được; không dùng tài khoản demo của app để thay cho kết quả tích hợp.

### 3. Xây theo luồng người dùng, ghép ngay khi xong từng phần

Sau đăng nhập, làm phần quản trị cơ sở, nhân viên, quyền và mẫu phiếu trước vì bệnh án cần các dữ liệu này. Tiếp theo làm luồng bệnh nhân tạo bệnh án và điền phiếu; luồng bác sĩ tiếp nhận và chốt bệnh án; rồi ảnh, tổn thương, UAS7, xét nghiệm và đơn thuốc.

Với mỗi chức năng, backend và người làm giao diện thống nhất API trước. Người làm giao diện có thể dùng dữ liệu mẫu trong lúc chờ backend, nhưng phải ghép với API thật và chạy lại kịch bản trên điện thoại/website trước khi báo hoàn thành. QA kiểm tra cả trường hợp đúng, sai dữ liệu, sai quyền và mất kết nối. Không để đến cuối dự án mới ghép các phần.

### 4. Kiểm thử và bàn giao

Khi các luồng đã chạy, nhóm kiểm thử từ đầu đến cuối với tài khoản bệnh nhân, bác sĩ và admin. Kiểm tra trạng thái bệnh án `pending → in_progress → completed`, quyền xem dữ liệu của người khác, upload ảnh, tính UAS7 và các lỗi API. Sau khi sửa lỗi, một thành viên không viết backend làm theo hướng dẫn để dựng hệ thống bằng Docker Compose và chạy lại buổi demo. Nếu người đó không tự chạy được, tài liệu bàn giao chưa xong.

## Chia việc trong nhóm

Trưởng nhóm điền tên người thực hiện trước khi bắt đầu. Một người có thể kiêm nhiều phần, nhưng mỗi phần cần một người chịu trách nhiệm chính.

- Trưởng nhóm: ______ — giữ danh sách công việc, theo dõi phần phụ thuộc, giải quyết điểm chưa rõ và tổ chức demo chung.
- Backend và database: ______ — API theo OpenAPI, PostgreSQL, MinIO, phân quyền, Docker Compose và tài khoản test. Bạn đang nhận phần này.
- Mobile: ______ — các màn hình bệnh nhân/nhân viên trên điện thoại và tích hợp API.
- Web: ______ — các màn hình bác sĩ cơ bản, quản trị và tích hợp cùng API.
- Thiết kế giao diện: ______ — luồng màn hình, trạng thái tải/lỗi và cách hiển thị cho từng vai trò.
- Kiểm thử, tài liệu demo: ______ — test case, theo dõi lỗi, hướng dẫn chạy và kịch bản bàn giao.

Mỗi đầu việc trên bảng công việc cần ghi đủ: **ai làm, cần API/dữ liệu gì, kết quả chạy được là gì, ai kiểm tra**. Ví dụ “đăng nhập” chỉ được đóng khi backend trả đúng OpenAPI, mobile/web xử lý được đăng nhập sai, và tài khoản thật đi vào đúng màn hình. Thay đổi API hoặc database phải báo cho những người đang dùng nó trước khi ghép code.

Nhóm nên có một lần chạy thử chung sau mỗi cụm chức năng. Ở buổi đó, mọi người xem sản phẩm đang chạy và ghi lỗi hoặc việc còn thiếu; không chỉ báo cáo số màn hình hay số endpoint đã viết.

## Khi nào coi là đạt?

PRD đặt các mốc để kiểm tra: tìm hồ sơ bệnh nhân dưới 1 giây; uptime 99%; tối đa 10 ảnh mỗi lần và không quá 5 MB mỗi ảnh; chấm UAS7 trong không quá 3 thao tác; câu hỏi rẽ nhánh hiện ngay, không tải lại. Nhóm cần thống nhất cách đo và môi trường đo, đặc biệt với chỉ số uptime khi phạm vi hiện tại là demo local.

Một chức năng chỉ “xong” khi đúng PRD/OpenAPI, chạy qua API thật với dữ liệu thử nghiệm, có người khác kiểm tra và không còn lỗi nghiêm trọng. Dữ liệu bệnh nhân thật không được dùng làm dữ liệu demo. Bản seed có tài khoản admin mẫu; phải đổi hoặc vô hiệu hóa nếu hệ thống được dùng ngoài môi trường thử nghiệm.

## Tài liệu tham chiếu

- [PRD](<[MayDay] Product Requirements Document.pdf>): mục tiêu, phạm vi, ba giai đoạn và tiêu chí thành công.
- [Use Case Diagram](<[MayDay] Use Case Diagram.pdf>): tác nhân và thao tác.
- [Class Diagram](<[MayDay] Class Diagram.pdf>) và [ERD](<[MayDay] Entity Relationship Diagram.pdf>): cấu trúc nghiệp vụ và dữ liệu.
- [OpenAPI](<[MayDay] openapi.yaml>): hợp đồng API, quyền, mã lỗi và quy tắc chi tiết để lập trình.

Nếu các tài liệu trên không khớp nhau, trưởng nhóm ghi vấn đề, người quyết định và kết luận; sau đó cập nhật tài liệu liên quan trước khi giao tiếp công việc. Kế hoạch này chỉ mô tả cách thực hiện, không thay thế các tài liệu chuẩn.
