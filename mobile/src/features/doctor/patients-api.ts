import { isAxiosError } from "axios";
import { apiClient, apiUrl } from "@/api/client";
import type { Session } from "@/features/auth/session";

export type Patient = {
  user_id: number;
  full_name: string;
  phone: string;
  gender: "male" | "female" | "other" | null;
  year_of_birth: number | null;
  created_at: string;
};

export type PatientHistory = {
  medical_record_id: number;
  status: "pending" | "in_progress" | "completed";
  instructions: string | null;
  created_at: string;
};

async function request<T>(
  session: Session,
  url: string,
  method: "GET" | "POST",
  data?: object,
  params?: object,
): Promise<T> {
  if (!apiUrl) throw new Error("Chưa cấu hình địa chỉ backend.");
  try {
    const response = await apiClient.request<{ code: string; data: T }>({
      url,
      method,
      data,
      params,
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (response.data.code !== (method === "POST" ? "1001" : "1000"))
      throw new Error("Yêu cầu không thành công.");
    return response.data.data;
  } catch (error) {
    if (isAxiosError<{ code?: string }>(error)) {
      const messages: Record<string, string> = {
        "2001": "Vui lòng điền đủ thông tin bắt buộc hoặc từ khóa tìm kiếm.",
        "2002": "Thông tin nhập chưa đúng định dạng.",
        "2004": "Số điện thoại phải có 10 số, đầu 03, 05, 07, 08 hoặc 09.",
        "2007":
          "Kiểm tra lại thông tin: mật khẩu từ 6 ký tự, năm sinh và ngày hợp lệ.",
        "3006":
          "Số điện thoại đã có tài khoản. Hãy tìm bệnh nhân trước khi tạo mới.",
        "3001": "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.",
        "3002": "Phiên đăng nhập hết hạn. Hãy đăng nhập lại.",
        "3003": "Hãy đăng nhập để tiếp tục.",
        "3101": "Bạn không có quyền thực hiện thao tác này.",
        "3103": "Chức năng này chỉ dành cho bác sĩ.",
        "9902": "Không truy cập được cơ sở dữ liệu. Hãy thử lại.",
      };
      throw new Error(
        messages[error.response?.data?.code ?? ""] ??
          "Không kết nối được backend. Hãy thử lại.",
      );
    }
    throw error;
  }
}

export const patientsApi = {
  search: (session: Session, phone: string, name: string) =>
    request<Patient[]>(session, "/doctor/patients/search", "GET", undefined, {
      phone: phone.trim() || undefined,
      full_name: name.trim() || undefined,
    }),
  create: (session: Session, input: Record<string, string | number>) =>
    request<Patient>(session, "/doctor/patients", "POST", input),
  history: (session: Session, patientId: number) =>
    request<PatientHistory[]>(
      session,
      `/medical_records/patients/${patientId}/history`,
      "GET",
    ),
};
