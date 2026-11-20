import { apiRequest, requireApiCode, type ApiEnvelope } from "@/api/client";
import type { Session } from "@/features/auth/session";
import type { ImageAttachment } from "@/features/records/image-attachments-api";

export type LesionLocation = {
  location_id: string;
  episode_id: string;
  body_part: string;
  occurred_at: string | null;
};
export type Milestone = "start" | "peak" | "normal";
export type LesionPhoto = {
  photo_id: string;
  location_id: string | null;
  milestone: Milestone;
  itch_score: string | null;
  pain_score: string | null;
  burn_score: string | null;
  hives_count: string | null;
  taken_at: string | null;
  created_at: string;
  attachment: ImageAttachment;
};

async function request<T>(
  session: Session,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  data?: object,
): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(
    { method, url: path, data },
    session.token,
  );
  return requireApiCode(
    response,
    [method === "post" ? "1001" : "1000"],
    `${method} ${path}`,
  ).data;
}

export const lesionDetailsApi = {
  locations: (session: Session, episodeId: string) =>
    request<LesionLocation[]>(
      session,
      "get",
      `/lesion-locations/episode/${episodeId}`,
    ),
  createLocation: (session: Session, episodeId: string, bodyPart: string) =>
    request<LesionLocation>(session, "post", "/lesion-locations", {
      episode_id: episodeId,
      body_part: bodyPart,
      occurred_at: new Date().toISOString(),
    }),
  renameLocation: (session: Session, locationId: string, bodyPart: string) =>
    request<LesionLocation>(
      session,
      "patch",
      `/lesion-locations/${locationId}`,
      { body_part: bodyPart },
    ),
  removeLocation: (session: Session, locationId: string) =>
    request(session, "delete", `/lesion-locations/${locationId}`),
  photos: (session: Session, episodeId: string) =>
    request<LesionPhoto[]>(
      session,
      "get",
      `/lesion-photos/episode/${episodeId}`,
    ),
  createPhoto: (session: Session, input: object) =>
    request<LesionPhoto>(session, "post", "/lesion-photos", input),
  updatePhoto: (session: Session, photoId: string, input: object) =>
    request<LesionPhoto>(
      session,
      "patch",
      `/lesion-photos/${photoId}/milestone`,
      input,
    ),
  removePhoto: (session: Session, photoId: string) =>
    request(session, "delete", `/lesion-photos/${photoId}`),
};
