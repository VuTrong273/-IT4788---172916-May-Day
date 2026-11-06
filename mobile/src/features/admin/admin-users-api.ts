import { apiRequest, requireApiCode, type ApiEnvelope } from '@/api/client';
import type { Session } from '@/features/auth/session';

export type AdminUserListItem = {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  is_active: 0 | 1;
};

export type AdminUserDetail = {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  gender?: 'male' | 'female' | 'other' | null;
  is_active?: 0 | 1;
  branch_id?: number | null;
  department_id?: number | null;
  room_id?: number | null;
};

export type CreateAdminUserInput = {
  full_name: string;
  phone: string;
  password: string;
  gender?: 'male' | 'female' | 'other';
  role_id: number;
  is_active?: 0 | 1;
};

export type CreateStaffInput = {
  full_name: string;
  phone: string;
  password: string;
  gender?: 'male' | 'female' | 'other';
  role_id: number;
  branch_id: number;
  department_id: number;
  room_id?: number;
};

export type UpdateAdminUserInput = {
  full_name?: string;
  gender?: 'male' | 'female' | 'other';
  role_id?: number;
  is_active?: 0 | 1;
};

export type AssignStaffInput = {
  branch_id: number;
  department_id: number;
  room_id: number | null;
};

export type AdminUserPage = ApiEnvelope<AdminUserListItem[]> & {
  total?: number;
  page?: number;
  limit?: number;
};

async function request<T>(
  session: Session,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: unknown,
  params?: Record<string, number | undefined>,
  successCodes: readonly string[] = ['1000'],
): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(
    { method, url, data, params },
    session.token,
  );
  return requireApiCode(response, successCodes, `${method.toUpperCase()} ${url}`).data;
}

export const adminUsersApi = {
  async listUsers(
    session: Session,
    options: { page: number; limit: number; roleId?: number },
  ): Promise<AdminUserPage> {
    const response = await apiRequest<AdminUserPage>(
      {
        method: 'get',
        url: '/admin/users',
        params: {
          page: options.page,
          limit: options.limit,
          role_id: options.roleId,
        },
      },
      session.token,
    );
    return requireApiCode(response, ['1000'], 'GET /admin/users');
  },

  createUser(session: Session, input: CreateAdminUserInput) {
    return request<AdminUserListItem>(
      session,
      'post',
      '/admin/users',
      input,
      undefined,
      ['1001'],
    );
  },

  createStaff(session: Session, input: CreateStaffInput) {
    return request<AdminUserDetail>(
      session,
      'post',
      '/auth/admin/create-staff',
      input,
      undefined,
      ['1001'],
    );
  },

  getUser(session: Session, id: number) {
    return request<AdminUserDetail>(session, 'get', `/admin/users/${id}`);
  },

  updateUser(session: Session, id: number, input: UpdateAdminUserInput) {
    return request<AdminUserDetail>(session, 'put', `/admin/users/${id}`, input);
  },

  deleteUser(session: Session, id: number) {
    return request<Record<string, never>>(session, 'delete', `/admin/users/${id}`);
  },

  assignStaff(session: Session, id: number, input: AssignStaffInput) {
    return request<{
      user_id: number;
      branch_id: number;
      department_id: number;
      room_id: number | null;
    }>(session, 'put', `/admin/users/${id}/assign`, input);
  },
};
