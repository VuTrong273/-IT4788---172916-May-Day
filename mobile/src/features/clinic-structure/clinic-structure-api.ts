import {
  apiRequest,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type Branch = {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
};

export type Department = {
  id: number;
  name: string;
  description?: string | null;
  branch_id: number;
  created_at?: string;
  updated_at?: string;
};

export type Room = {
  id: number;
  name: string;
  description?: string | null;
  department_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type BranchInput = {
  name: string;
  address: string;
  phone: string;
};

export type BranchUpdate = Partial<BranchInput>;

export type DepartmentInput = {
  name: string;
  description?: string;
  branch_id: number;
};

export type DepartmentUpdate = Partial<DepartmentInput>;

export type RoomInput = {
  name: string;
  description?: string;
  department_id: number;
};

export type RoomUpdate = Partial<RoomInput>;

async function request<T>(
  session: Session,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  options: {
    data?: unknown;
    params?: Record<string, number>;
    successCodes?: readonly string[];
  } = {},
): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(
    { method, url, data: options.data, params: options.params },
    session.token,
  );
  const operation = `${method.toUpperCase()} ${url}`;
  const acceptedCodes = options.successCodes ?? ['1000'];
  return requireApiCode(response, acceptedCodes, operation).data;
}

export const clinicStructureApi = {
  createBranch: (session: Session, input: BranchInput) =>
    request<Branch>(session, 'post', '/branches', {
      data: input,
      successCodes: ['1001'],
    }),
  listBranches: (session: Session) =>
    request<Branch[]>(session, 'get', '/branches'),
  getBranch: (session: Session, id: number) =>
    request<Branch>(session, 'get', `/branches/${id}`),
  updateBranch: (session: Session, id: number, input: BranchUpdate) =>
    request<Branch>(session, 'put', `/branches/${id}`, { data: input }),
  deleteBranch: (session: Session, id: number) =>
    request<Record<string, never>>(session, 'delete', `/branches/${id}`),

  createDepartment: (session: Session, input: DepartmentInput) =>
    request<Department>(session, 'post', '/departments', {
      data: input,
      successCodes: ['1001'],
    }),
  listDepartments: (session: Session, branchId?: number) =>
    request<Department[]>(session, 'get', '/departments', {
      params: branchId === undefined ? undefined : { branch_id: branchId },
    }),
  getDepartment: (session: Session, id: number) =>
    request<Department>(session, 'get', `/departments/${id}`),
  updateDepartment: (
    session: Session,
    id: number,
    input: DepartmentUpdate,
  ) => request<Department>(session, 'put', `/departments/${id}`, { data: input }),
  deleteDepartment: (session: Session, id: number) =>
    request<Record<string, never>>(session, 'delete', `/departments/${id}`),

  createRoom: (session: Session, input: RoomInput) =>
    request<Room>(session, 'post', '/rooms', {
      data: input,
      successCodes: ['1001'],
    }),
  listRooms: (session: Session, departmentId?: number) =>
    request<Room[]>(session, 'get', '/rooms', {
      params: departmentId === undefined ? undefined : { department_id: departmentId },
    }),
  getRoom: (session: Session, id: number) =>
    request<Room>(session, 'get', `/rooms/${id}`),
  updateRoom: (session: Session, id: number, input: RoomUpdate) =>
    request<Room>(session, 'put', `/rooms/${id}`, { data: input }),
  deleteRoom: (session: Session, id: number) =>
    request<Record<string, never>>(session, 'delete', `/rooms/${id}`),
};
