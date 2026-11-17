# Mã nguồn ảnh từ bản sao lưu trước khi merge

Các tệp `*.txt` giữ nguyên mã nguồn TypeScript của giao diện lọc và so sánh ảnh. Chúng chưa được kích hoạt vì tham chiếu tới `lesions-api`, `tracking-styles`, `ChoiceField` và `DateField`, vốn không có trong ứng dụng hiện tại. Không đổi phần mở rộng thành `.ts`/`.tsx` trước khi nối với API ảnh và các component hiện hành.

Hai tệp `*.test.mjs` là các bài kiểm tra gốc của bản sao lưu, giữ lại làm tài liệu tham khảo. Biểu đồ UAS7 đã được chuyển vào `src/features/uas7` và gắn vào màn hình UAS7.
