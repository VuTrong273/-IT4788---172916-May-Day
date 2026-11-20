import { apiRequest, requireApiCode, type ApiEnvelope } from "@/api/client";
import type { Session } from "./session.shared";
import type { AccessSnapshot } from "./permissions";
import { publishAccess } from "./access-events";

const pending = new Map<string, Promise<AccessSnapshot>>();
export async function refreshSessionAccess(session: Session): Promise<Session> {
  let request = pending.get(session.token);
  if (!request) {
    request = apiRequest<ApiEnvelope<AccessSnapshot>>(
      { method: "get", url: "/auth/access" },
      session.token,
    )
      .then(
        (response) =>
          requireApiCode(response, ["1000"], "GET /auth/access").data,
      )
      .finally(() => pending.delete(session.token));
    pending.set(session.token, request);
  }
  const access = await request;
  if (access.user_id !== session.user.user_id)
    throw new Error("Thông tin quyền truy cập không khớp tài khoản.");
  const updated = {
    ...session,
    accessError: undefined,
    access,
    user: {
      ...session.user,
      role_id: access.role_id,
      base_role: access.base_role,
    },
  };
  publishAccess(updated);
  return updated;
}
