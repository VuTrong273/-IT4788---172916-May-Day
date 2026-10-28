import { isAxiosError, type AxiosRequestConfig } from "axios";

import { apiClient, apiUrl } from "@/api/client";
import type { Session } from "@/features/auth/session";

export type TemplateItem = {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: "0" | "1";
  created_at: string;
};

export type TemplateInput = {
  code_template: string;
  name: string;
  description: string;
  version: string;
  is_active: "0" | "1";
};

function apiError(error: unknown): Error {
  if (isAxiosError<{ code?: string; message?: string }>(error)) {
    const code = error.response?.data?.code;
    if (code === "4101")
      return new Error("Mẫu phiếu không còn tồn tại. Hãy tải lại danh sách.");
    if (code === "4105")
      return new Error(
        "Mẫu đã có lần khám nên không thể xóa. Bạn có thể tắt mẫu để ngừng sử dụng.",
      );
    if (code === "4102")
      return new Error("Mã mẫu phiếu đã tồn tại. Hãy chọn mã khác.");
    if (["3001", "3002", "3003"].includes(code ?? ""))
      return new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
    return new Error(
      error.response?.data?.message ||
        "Không kết nối được backend. Hãy thử lại.",
    );
  }
  return error instanceof Error
    ? error
    : new Error("Có lỗi xảy ra. Hãy thử lại.");
}

type ApiResponse<T> = {
  code: string;
  data: T;
};

type UpdateTemplateInput = Partial<Omit<TemplateInput, "code_template">>;

function templatePath(code: string): string {
  return `/templates/${encodeURIComponent(code)}`;
}

async function request<T>(
  session: Session,
  config: AxiosRequestConfig,
  expectedCode: "1000" | "1001",
  failureMessage: string,
): Promise<T> {
  if (!apiUrl) throw new Error("Chưa cấu hình địa chỉ backend.");

  try {
    const response = await apiClient.request<ApiResponse<T>>({
      ...config,
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (response.data.code !== expectedCode) throw new Error(failureMessage);
    return response.data.data;
  } catch (error) {
    throw apiError(error);
  }
}

export const templatesApi = {
  list(session: Session): Promise<TemplateItem[]> {
    return request(
      session,
      {
        method: "GET",
        url: "/templates/all",
        params: { page: 1, limit: 100 },
      },
      "1000",
      "Không tải được mẫu phiếu.",
    );
  },

  create(session: Session, input: TemplateInput): Promise<TemplateItem> {
    return request(
      session,
      {
        method: "POST",
        url: "/templates",
        data: input,
      },
      "1001",
      "Không tạo được mẫu phiếu.",
    );
  },

  update(
    session: Session,
    code: string,
    input: UpdateTemplateInput,
  ): Promise<TemplateItem> {
    return request(
      session,
      {
        method: "PUT",
        url: templatePath(code),
        data: input,
      },
      "1000",
      "Không cập nhật được mẫu phiếu.",
    );
  },

  async delete(session: Session, code: string): Promise<void> {
    await request(
      session,
      {
        method: "DELETE",
        url: templatePath(code),
      },
      "1000",
      "Không xóa được mẫu phiếu.",
    );
  },
};
