import type { Row } from "./api";

export const displayRole = (name: unknown): string =>
  ({ admin: "Quản trị viên", doctor: "Bác sĩ", patient: "Bệnh nhân" })[
    String(name)
  ] ?? String(name ?? "Vai trò");

const resources: Record<string, [string, string]> = {
  medical_record: ["bệnh án", "Khám bệnh"],
  "medical_record.answer": ["câu trả lời phiếu khám", "Khám bệnh"],
  doctor_patient: ["hồ sơ bệnh nhân", "Khám bệnh"],
  lab_request: ["chỉ định xét nghiệm", "Xét nghiệm và đơn thuốc"],
  lab_result: ["kết quả xét nghiệm", "Xét nghiệm và đơn thuốc"],
  prescription: ["đơn thuốc", "Xét nghiệm và đơn thuốc"],
  lesion_episode: ["đợt tổn thương", "Theo dõi sức khỏe"],
  lesion_location: ["vị trí tổn thương", "Theo dõi sức khỏe"],
  lesion_photo: ["ảnh theo mốc tổn thương", "Theo dõi sức khỏe"],
  uas7: ["điểm UAS7", "Theo dõi sức khỏe"],
  media: ["ảnh đính kèm", "Ảnh và phiếu khám"],
  answer_image: ["ảnh trong câu trả lời", "Ảnh và phiếu khám"],
  template: ["mẫu phiếu khám", "Thiết kế mẫu phiếu"],
  "template.section": ["phần của phiếu khám", "Thiết kế mẫu phiếu"],
  "template.question": ["câu hỏi trong phiếu", "Thiết kế mẫu phiếu"],
  user: ["tài khoản người dùng", "Quản lý tài khoản"],
  branch: ["chi nhánh", "Cơ sở khám"],
  department: ["khoa", "Cơ sở khám"],
  room: ["phòng khám", "Cơ sở khám"],
  profile: ["thông tin cá nhân", "Thông tin cá nhân và bảo mật"],
  role: ["vai trò", "Phân quyền"],
  permission: ["danh mục quyền", "Phân quyền"],
  role_permission: ["quyền cho vai trò", "Phân quyền"],
  api_endpoint: ["kết nối hệ thống", "Cấu hình hệ thống nâng cao"],
  permission_endpoint: [
    "quyền truy cập kỹ thuật",
    "Cấu hình hệ thống nâng cao",
  ],
};
const actions: Record<string, string> = {
  create: "Tạo",
  delete: "Xóa",
  read: "Xem",
  list: "Xem danh sách",
  update: "Chỉnh sửa",
  write: "Nhập và cập nhật",
  assign: "Gán",
  revoke: "Thu hồi",
  search: "Tìm kiếm",
  upload: "Tải lên",
};
const specific: Record<string, string> = {
  "auth.session": "Đăng xuất tài khoản",
  "auth.change_password": "Đổi mật khẩu và thiết lập email khôi phục",
  "auth.create_staff": "Tạo tài khoản nhân viên",
  "medical_record.accept": "Tiếp nhận bệnh án",
  "medical_record.complete": "Hoàn tất khám và điều khiển theo dõi tại nhà",
  "medical_record.classify": "Phân loại và chọn mẫu phiếu khám",
  "medical_record.history": "Xem lịch sử khám bệnh",
  "lesion_episode.read_own": "Xem các đợt tổn thương của bản thân",
  "lesion_episode.read_record": "Xem đợt tổn thương theo bệnh án",
  "uas7.eligibility": "Kiểm tra điều kiện chấm UAS7",
  "user.assign": "Phân công vị trí công tác cho nhân viên",
};
export function describePermission(row: Row): { title: string; group: string } {
  const name = String(row.name ?? "");
  const split = name.lastIndexOf(".");
  const resource = name.slice(0, split),
    action = name.slice(split + 1);
  const info = resources[resource];
  const group =
    name === "auth.create_staff"
      ? "Quản lý tài khoản"
      : name.startsWith("auth.")
        ? "Thông tin cá nhân và bảo mật"
        : (info?.[1] ?? "Chức năng tùy chỉnh");
  return {
    group,
    title:
      specific[name] ??
      (info && actions[action]
        ? `${actions[action]} ${info[0]}`
        : String(row.description || row.name || "Chức năng tùy chỉnh")),
  };
}
