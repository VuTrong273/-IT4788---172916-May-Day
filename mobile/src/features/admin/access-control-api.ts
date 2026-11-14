import { apiRequest, requireApiCode, type ApiEnvelope } from '@/api/client';
import type { Session } from '@/features/auth/session';

export type AccessRole = {
  id: number;
  name: string;
  description?: string | null;
  parent_role_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type AccessPermission = {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type CatalogEndpoint = {
  id: number;
  name: string;
  method: ApiMethod;
  path: string;
  description?: string | null;
  is_public?: 0 | 1;
  created_at?: string;
  updated_at?: string;
};

export type RoleWrite = {
  name: string;
  description?: string;
  parent_role_id?: number | null;
};

export type PermissionWrite = {
  name: string;
  description?: string;
};

export type EndpointWrite = {
  name: string;
  method: ApiMethod;
  path: string;
  description?: string;
  is_public: 0 | 1;
};

export type RolePermissionMapping = {
  role_permission_id: number;
  permission_id: number;
  name: string;
  description?: string | null;
  assigned_at?: string;
};

export type PermissionEndpointMapping = {
  permission_endpoint_id: number;
  endpoint_id: number;
  name: string;
  method: ApiMethod;
  path: string;
  assigned_at?: string;
};

type EndpointListResponse = ApiEnvelope<CatalogEndpoint[]> & {
  total: number;
  page: number;
  limit: number;
};

async function getData<T>(
  session: Session,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  data?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(
    { method, url: path, data, params },
    session.token,
  );
  return requireApiCode(response, ['1000'], `${method.toUpperCase()} ${path}`).data;
}

async function mutate<T>(
  session: Session,
  method: 'post' | 'put',
  path: string,
  data: unknown,
): Promise<T> {
  return getData<T>(session, method, path, data);
}

async function remove(session: Session, path: string): Promise<void> {
  await getData<Record<string, never>>(session, 'delete', path);
}

export const accessControlApi = {
  async listRoles(session: Session): Promise<AccessRole[]> {
    return getData(session, 'get', '/roles');
  },
  async createRole(session: Session, input: RoleWrite): Promise<AccessRole> {
    return mutate(session, 'post', '/roles', input);
  },
  async updateRole(
    session: Session,
    id: number,
    input: RoleWrite,
  ): Promise<AccessRole> {
    return mutate(session, 'put', `/roles/${id}`, input);
  },
  async deleteRole(session: Session, id: number): Promise<void> {
    return remove(session, `/roles/${id}`);
  },

  async listRolePermissions(
    session: Session,
    roleId: number,
  ): Promise<RolePermissionMapping[]> {
    return getData(session, 'get', `/role_permissions/role/${roleId}`);
  },
  async assignRolePermission(
    session: Session,
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    await mutate(session, 'post', '/role_permissions', {
      role_id: roleId,
      permissions: [permissionId],
    });
  },
  async revokeRolePermission(
    session: Session,
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    return remove(
      session,
      `/role_permissions/role/${roleId}/permission/${permissionId}`,
    );
  },

  async listPermissions(session: Session): Promise<AccessPermission[]> {
    return getData(session, 'get', '/permissions');
  },
  async createPermission(
    session: Session,
    input: PermissionWrite,
  ): Promise<AccessPermission> {
    return mutate(session, 'post', '/permissions', input);
  },
  async updatePermission(
    session: Session,
    id: number,
    input: PermissionWrite,
  ): Promise<AccessPermission> {
    return mutate(session, 'put', `/permissions/${id}`, input);
  },
  async deletePermission(session: Session, id: number): Promise<void> {
    return remove(session, `/permissions/${id}`);
  },

  async listPermissionEndpoints(
    session: Session,
    permissionId: number,
  ): Promise<PermissionEndpointMapping[]> {
    return getData(
      session,
      'get',
      `/permission_endpoints/permission/${permissionId}`,
    );
  },
  async assignPermissionEndpoint(
    session: Session,
    permissionId: number,
    endpointId: number,
  ): Promise<void> {
    await mutate(session, 'post', '/permission_endpoints', {
      permission_id: permissionId,
      endpoints: [endpointId],
    });
  },
  async revokePermissionEndpoint(
    session: Session,
    permissionId: number,
    endpointId: number,
  ): Promise<void> {
    return remove(
      session,
      `/permission_endpoints/permission/${permissionId}/endpoint/${endpointId}`,
    );
  },

  async listEndpoints(
    session: Session,
    options: { page: number; limit: number; method?: ApiMethod },
  ): Promise<EndpointListResponse> {
    const response = await apiRequest<EndpointListResponse>(
      {
        method: 'get',
        url: '/api_endpoints',
        params: {
          page: options.page,
          limit: options.limit,
          method: options.method,
        },
      },
      session.token,
    );
    return requireApiCode(response, ['1000'], 'GET /api_endpoints');
  },
  async createEndpoint(
    session: Session,
    input: EndpointWrite,
  ): Promise<CatalogEndpoint> {
    return mutate(session, 'post', '/api_endpoints', input);
  },
  async updateEndpoint(
    session: Session,
    id: number,
    input: EndpointWrite,
  ): Promise<CatalogEndpoint> {
    return mutate(session, 'put', `/api_endpoints/${id}`, input);
  },
  async deleteEndpoint(session: Session, id: number): Promise<void> {
    return remove(session, `/api_endpoints/${id}`);
  },
};
