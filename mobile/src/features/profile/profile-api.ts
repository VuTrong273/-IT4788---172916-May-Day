import { isAxiosError } from "axios";

import { apiClient, apiUrl } from "@/api/client";
import type { Session } from "@/features/auth/session";

export type Profile = {
  user_id: number;
  full_name: string;
  phone: string;
  recovery_email?: string | null;
  role_id: number;
  gender?: "male" | "female" | "other" | null;
  year_of_birth?: number | null;
  career?: string | null;
};

type ProfileResponse = {
  code: string;
  message: string;
  data: Profile;
};

export class SessionExpiredError extends Error {}

export const profileApi = {
  async getProfile(session: Session): Promise<Profile> {
    if (!apiUrl) throw new Error("Chưa cấu hình địa chỉ backend.");

    try {
      const response = await apiClient.get<ProfileResponse>("/profile", {
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (response.data.code !== "1000") {
        throw new Error(response.data.message || "Không thể tải hồ sơ.");
      }

      return response.data.data;
    } catch (error) {
      if (isAxiosError<{ code?: string; message?: string }>(error)) {
        if (
          error.response?.status === 401 ||
          ["3001", "3002", "3003"].includes(error.response?.data?.code ?? "")
        ) {
          throw new SessionExpiredError("Phiên đăng nhập đã hết hạn.");
        }

        throw new Error(
          error.response?.data?.message ??
            "Không tải được hồ sơ. Hãy kiểm tra kết nối mạng.",
        );
      }
      throw error;
    }
  },
  async updateProfile(
    session: Session,
    changes: Partial<Omit<Profile, "user_id" | "role_id" | "recovery_email">>,
  ): Promise<Profile> {
    if (!apiUrl) throw new Error("Chưa cấu hình địa chỉ backend.");

    try {
      const response = await apiClient.put<ProfileResponse>(
        "/profile",
        changes,
        {
          headers: { Authorization: `Bearer ${session.token}` },
        },
      );

      if (response.data.code !== "1000") {
        throw new Error(response.data.message || "Không thể cập nhật hồ sơ.");
      }

      return response.data.data;
    } catch (error) {
      if (isAxiosError<{ code?: string; message?: string }>(error)) {
        if (
          error.response?.status === 401 ||
          ["3001", "3002", "3003"].includes(error.response?.data?.code ?? "")
        ) {
          throw new SessionExpiredError("Phiên đăng nhập đã hết hạn.");
        }

        throw new Error(
          error.response?.data?.code === "3006"
            ? "Số điện thoại này đã được dùng cho tài khoản khác."
            : (error.response?.data?.message ??
                "Không thể cập nhật hồ sơ. Hãy kiểm tra kết nối mạng."),
        );
      }
      throw error;
    }
  },
};
