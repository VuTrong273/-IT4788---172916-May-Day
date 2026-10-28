import { isAxiosError } from "axios";
import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { apiClient, apiUrl } from "@/api/client";
import type { Session } from "@/features/auth/session";

export type Episode = {
  episode_id: string;
  medical_record_id: string | null;
  name: string;
  occurred_at: string | null;
  description: string | null;
  context_other: string | null;
  medication_name: string | null;
};
export type LesionLocation = { location_id: string; body_part: string };
export type LesionPhoto = {
  photo_id: string;
  attachment_id: string;
  file_url: string;
  body_part: string | null;
  taken_at: string | null;
  created_at: string;
  milestone: "start" | "peak" | "normal";
  itch_score: number | null;
  pain_score: number | null;
  burn_score: number | null;
  hives_count: number | null;
};
export type Attachment = { id: string; file_url: string };
const errors: Record<string, string> = {
  "3105": "Bạn chưa được phân công theo dõi bệnh nhân này.",
  "3106": "Bạn không có quyền truy cập dữ liệu này.",
  "4003": "Lần khám đã hoàn tất, không thể ghi thêm dữ liệu.",
  "6002": "Chỉ nhận ảnh JPEG, PNG hoặc WebP.",
  "6003": "Ảnh vượt quá 5 MB.",
  "6007": "Kho ảnh chưa sẵn sàng. Hãy thử lại.",
  "7007": "Điểm ngứa, đau, rát phải từ 0 đến 10.",
  "7002": "Vị trí không thuộc đợt tổn thương này.",
};
function message(error: unknown) {
  return isAxiosError<{ code?: string }>(error)
    ? new Error(
        errors[error.response?.data?.code ?? ""] ??
          "Không tải/lưu được dữ liệu. Kiểm tra kết nối và thử lại.",
      )
    : error instanceof Error
      ? error
      : new Error("Có lỗi xảy ra.");
}
async function request<T>(
  session: Session,
  path: string,
  data?: object,
): Promise<T> {
  if (!apiUrl) throw new Error("Chưa cấu hình backend.");
  try {
    const result = await apiClient.request<{ code: string; data: T }>({
      url: path,
      method: data ? "POST" : "GET",
      data,
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (result.data.code !== (data ? "1001" : "1000"))
      throw new Error("Yêu cầu thất bại.");
    return result.data.data;
  } catch (error) {
    throw message(error);
  }
}
export const lesionsApi = {
  episodes: (session: Session, patientId: number, patient: boolean) =>
    request<Episode[]>(
      session,
      patient ? "/lesion-episodes/my" : `/lesion-episodes/patient/${patientId}`,
    ),
  createEpisode: (session: Session, data: object) =>
    request<Episode>(session, "/lesion-episodes", data),
  locations: (session: Session, episode: string) =>
    request<LesionLocation[]>(session, `/lesion-locations/episode/${episode}`),
  createLocation: (session: Session, episode: string, part: string) =>
    request<LesionLocation>(session, "/lesion-locations", {
      episode_id: episode,
      body_part: part,
    }),
  photos: (session: Session, episode: string) =>
    request<LesionPhoto[]>(session, `/lesion-photos/episode/${episode}`),
  createPhoto: (session: Session, data: object) =>
    request<LesionPhoto>(session, "/lesion-photos", data),
  async upload(session: Session, asset: ImagePickerAsset): Promise<Attachment> {
    const form = new FormData();
    if (Platform.OS === "web") {
      if (!asset.file) throw new Error("Không đọc được tệp ảnh.");
      form.append("file", asset.file);
    } else
      form.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "lesion.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);
    form.append("category", "lesion");
    try {
      const result = await apiClient.post<{ code: string; data: Attachment }>(
        "/image-attachments/upload",
        form,
        {
          headers: { Authorization: `Bearer ${session.token}` },
          timeout: 60000,
        },
      );
      if (result.data.code !== "1001")
        throw new Error("Không tải ảnh lên được.");
      return result.data.data;
    } catch (error) {
      throw message(error);
    }
  },
  async image(session: Session, attachmentId: string, signal: AbortSignal) {
    try {
      const response = await apiClient.get<ArrayBuffer>(
        `/image-attachments/${attachmentId}/content`,
        {
          responseType: "arraybuffer",
          headers: { Authorization: `Bearer ${session.token}` },
          signal,
        },
      );
      const bytes = new Uint8Array(response.data);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return `data:${String(response.headers["content-type"]).split(";")[0]};base64,${btoa(binary)}`;
    } catch (error) {
      throw message(error);
    }
  },
};
