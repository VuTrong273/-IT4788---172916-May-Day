export type EndpointGrant = { method: string; path: string };
export type AccessSnapshot = {
  user_id: number;
  role_id: number;
  base_role: "admin" | "doctor" | "patient" | null;
  endpoints: EndpointGrant[];
  routes: EndpointGrant[];
};

export function hasEndpoint(
  grants: readonly EndpointGrant[] | undefined,
  method: string,
  path: string,
  routes: readonly EndpointGrant[] = grants ?? [],
): boolean {
  const target = path
    .split("?")[0]
    .replace(/^\/api\/v1(?=\/|$)/, "")
    .split("/");
  const candidates = routes.filter((grant) => {
    if (grant.method !== method.toUpperCase()) return false;
    const parts = grant.path.replace(/^\/api\/v1(?=\/|$)/, "").split("/");
    return (
      parts.length === target.length &&
      parts.every((part, index) =>
        part.startsWith(":") || /^\{\w+\}$/.test(part)
          ? !!target[index]
          : part === target[index],
      )
    );
  });
  const specificity = (grant: EndpointGrant) =>
    grant.path
      .split("/")
      .filter(
        (part) => part && !part.startsWith(":") && !/^\{\w+\}$/.test(part),
      ).length;
  const best = Math.max(...candidates.map(specificity));
  return candidates
    .filter((grant) => specificity(grant) === best)
    .some((route) =>
      grants?.some(
        (grant) => grant.method === route.method && grant.path === route.path,
      ),
    );
}
