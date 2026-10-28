export const bodyParts = [
  "Mặt",
  "Cổ",
  "Ngực",
  "Lưng",
  "Bụng",
  "Tay trái",
  "Tay phải",
  "Chân trái",
  "Chân phải",
  "Bàn tay",
  "Bàn chân",
  "Toàn thân",
];
export const symptomDescriptions = [
  "Ngứa",
  "Nổi sẩn phù",
  "Ngứa và nổi sẩn phù",
  "Đỏ da",
  "Sưng",
  "Đau",
  "Rát",
];
export const episodeContexts = [
  "Chưa rõ",
  "Sau ăn",
  "Sau dùng thuốc",
  "Sau vận động",
  "Khi nóng / ra mồ hôi",
  "Khi lạnh",
  "Sau tì đè / cọ xát",
  "Khi căng thẳng",
  "Khi nghỉ ngơi",
];
export const careers = [
  "Học sinh / sinh viên",
  "Nhân viên văn phòng",
  "Công nhân",
  "Nông dân",
  "Kinh doanh",
  "Nội trợ",
  "Đã nghỉ hưu",
  "Chưa đi làm",
];
// Convenience choices only. Clinical values are never selected by default.
export const clinicalChoices: Record<string, readonly string[]> = {
  "Tần suất *": ["1 lần/ngày", "2 lần/ngày", "3 lần/ngày", "4 lần/ngày"],
  "Thời gian *": [
    "3 ngày",
    "5 ngày",
    "7 ngày",
    "10 ngày",
    "14 ngày",
    "28 ngày",
    "30 ngày",
  ],
  "Hướng dẫn": [
    "Uống trước ăn",
    "Uống sau ăn",
    "Uống buổi sáng",
    "Uống buổi tối",
  ],
  "Ghi chú đơn thuốc": [
    "Tái khám sau 1 tuần",
    "Tái khám sau 2 tuần",
    "Tái khám sau 1 tháng",
  ],
};
