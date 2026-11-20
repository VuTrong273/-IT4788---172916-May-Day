import type { IconName } from "@/components/ui/icon";

export type NavigationItem = { label: string; path: string; icon: IconName };

export const navigationItems: NavigationItem[] = [
  { label: "Tổng quan", path: "/app", icon: "dashboard" },
  { label: "Bệnh án", path: "/app/records", icon: "records" },
  { label: "Bệnh nhân", path: "/app/patients", icon: "patient" },
  { label: "Tài khoản", path: "/app/users", icon: "users" },
  { label: "Cơ sở khám", path: "/app/facilities", icon: "facility" },
  { label: "Mẫu phiếu", path: "/app/templates", icon: "template" },
  { label: "Phân quyền", path: "/app/access", icon: "shield" },
  { label: "Xét nghiệm", path: "/app/labs", icon: "lab" },
  { label: "Đơn thuốc", path: "/app/prescriptions", icon: "prescription" },
];

const requirements: Record<string, [string, string][]> = {
  "/app/records": [
    ["GET", "/medical_records/all"],
    ["GET", "/medical_records/:id"],
  ],
  "/app/patients": [["GET", "/doctor/patients/search"]],
  "/app/users": [["GET", "/admin/users"]],
  "/app/facilities": [
    ["GET", "/branches"],
    ["GET", "/departments"],
    ["GET", "/rooms"],
  ],
  "/app/templates": [["GET", "/templates/all"]],
  "/app/access": [
    ["GET", "/roles"],
    ["GET", "/permissions"],
    ["GET", "/api_endpoints"],
  ],
  "/app/labs": [
    ["GET", "/lab-results/:record_id"],
    ["GET", "/medical_records/:id"],
  ],
  "/app/prescriptions": [
    ["GET", "/prescriptions/:medical_record_id"],
    ["GET", "/medical_records/:id"],
  ],
  "/app/profile": [["GET", "/profile"]],
  "/app/profile/password": [["PUT", "/auth/change-password"]],
};
export function canOpenPage(
  path: string,
  can: (method: string, path: string) => boolean,
): boolean {
  if (/^\/app\/records\/[^/]+$/.test(path))
    return can("GET", `/medical_records/${path.split("/").pop()}`);
  const normalized = path;
  if (path === "/app") return true;
  const required = requirements[normalized];
  if (!required) return false;
  return ["/app/facilities", "/app/access"].includes(normalized)
    ? required.some(([method, endpoint]) => can(method, endpoint))
    : required.every(([method, endpoint]) => can(method, endpoint));
}
