import { Icon, type IconName } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';

type ModuleInfo = {
  title: string;
  description: string;
  icon: IconName;
  endpoints: string[];
  audience: string;
  workflow: string;
};

// This map follows the May Day OpenAPI contract. Being listed in OpenAPI does
// not mean an endpoint has already been implemented by the runtime backend.
const modules: Record<string, ModuleInfo> = {
  patients: {
    title: 'Bệnh nhân', description: 'Tìm người bệnh và tạo hồ sơ người bệnh trong quá trình tiếp nhận.',
    icon: 'patient', audience: 'Bác sĩ', workflow: 'Tìm kiếm theo thông tin người bệnh; chỉ tạo hồ sơ mới khi cần.',
    endpoints: ['GET /doctor/patients/search', 'POST /doctor/patients'],
  },
  users: {
    title: 'Tài khoản', description: 'Quản lý tài khoản, trạng thái, vai trò và phân công nhân viên.',
    icon: 'users', audience: 'Quản trị viên', workflow: 'Tạo hoặc cập nhật tài khoản, sau đó phân công nhân viên vào cơ sở, khoa và phòng.',
    endpoints: ['GET /admin/users', 'POST /admin/users', 'GET /admin/users/{id}', 'PUT /admin/users/{id}', 'DELETE /admin/users/{id}', 'PUT /admin/users/{id}/assign'],
  },
  facilities: {
    title: 'Cơ sở khám', description: 'Tổ chức hệ thống chi nhánh, khoa và phòng theo cấu trúc cơ sở khám.',
    icon: 'facility', audience: 'Quản trị viên', workflow: 'Quản lý chi nhánh trước, rồi thiết lập khoa và phòng trực thuộc; quan hệ đang được sử dụng có thể chặn thao tác xoá.',
    endpoints: ['GET /branches · POST /branches · PUT /branches/{id} · DELETE /branches/{id}', 'GET /departments · POST /departments · PUT /departments/{id} · DELETE /departments/{id}', 'GET /rooms · POST /rooms · PUT /rooms/{id} · DELETE /rooms/{id}'],
  },
  templates: {
    title: 'Mẫu phiếu khám', description: 'Thiết kế mẫu khám theo cấu trúc mẫu → phần → câu hỏi → lựa chọn.',
    icon: 'template', audience: 'Quản trị viên', workflow: 'Tạo mẫu, sắp xếp phần và câu hỏi; mẫu đang được bệnh án sử dụng không thể xoá.',
    endpoints: ['GET /templates/all · GET /templates/{id}', 'POST /templates · PUT /templates/{id} · DELETE /templates/{id}', 'POST /templates/{template_id}/sections · PUT /templates/sections/{id} · DELETE /templates/sections/{id}', 'POST /templates/sections/{section_id}/questions · PUT /templates/questions/{id} · DELETE /templates/questions/{id}'],
  },
  access: {
    title: 'Phân quyền', description: 'Cấu hình vai trò, quyền và ánh xạ quyền tới các API theo RBAC.',
    icon: 'shield', audience: 'Quản trị viên', workflow: 'Tạo quyền và vai trò, gán quyền cho vai trò, rồi liên kết quyền với endpoint theo method và path.',
    endpoints: ['GET/POST/PUT/DELETE /roles', 'GET/POST/PUT/DELETE /permissions', 'GET/POST/DELETE /role_permissions', 'GET/POST/PUT/DELETE /api_endpoints', 'GET/POST/DELETE /permission_endpoints'],
  },
  labs: {
    title: 'Xét nghiệm', description: 'Chỉ định xét nghiệm và cập nhật kết quả trong ngữ cảnh bệnh án.',
    icon: 'lab', audience: 'Bác sĩ', workflow: 'Mở bệnh án để xem chỉ định/kết quả, tạo chỉ định và nhập kết quả theo nghiệp vụ.',
    endpoints: ['POST /lab-requests', 'GET /lab-results/{record_id}', 'POST /lab-results'],
  },
  prescriptions: {
    title: 'Đơn thuốc', description: 'Kê đơn thuốc gắn với bệnh án và xem lại nội dung đơn.',
    icon: 'prescription', audience: 'Bác sĩ', workflow: 'Tạo đơn theo bệnh án; mỗi bệnh án chỉ có một đơn theo quy tắc nghiệp vụ.',
    endpoints: ['POST /prescriptions', 'GET /prescriptions/{medical_record_id}'],
  },
};

export function ModuleUnavailablePage({ moduleKey }: { moduleKey: string }) {
  const module = modules[moduleKey] ?? modules.patients;
  return (
    <>
      <PageHeader eyebrow="KHÔNG GIAN NGHIỆP VỤ" title={module.title} description={module.description} />
      <section className="module-workspace" aria-labelledby="module-workspace-title">
        <div className="module-workspace__hero">
          <span className="module-workspace__icon"><Icon name={module.icon} size={24} /></span>
          <div>
            <span className="module-status"><span />THEO ĐẶC TẢ MAY DAY</span>
            <h2 id="module-workspace-title">Quy trình nghiệp vụ</h2>
            <p>{module.workflow}</p>
          </div>
        </div>
        <div className="module-workspace__body">
          <div><span className="eyebrow">ENDPOINT TRONG OPENAPI</span><div className="endpoint-list">{module.endpoints.map((endpoint) => <code key={endpoint}>{endpoint}</code>)}</div></div>
          <div className="module-audience"><span className="detail-label">Đối tượng sử dụng</span><strong>{module.audience}</strong><p>Quyền truy cập và quyền sở hữu dữ liệu do backend kiểm tra.</p></div>
        </div>
      </section>
      <div className="module-note"><Icon name="alert" size={17} /><span>OpenAPI là hợp đồng yêu cầu, không xác nhận endpoint đã có trong backend đang chạy. Màn hình này chưa gọi API hoặc giả lập dữ liệu; cần tích hợp sau khi xác nhận endpoint runtime và response thực tế.</span></div>
    </>
  );
}
