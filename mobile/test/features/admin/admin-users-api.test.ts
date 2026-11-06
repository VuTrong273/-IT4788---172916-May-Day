import { apiRequest } from '@/api/client';
import {
  adminUsersApi,
  type AdminUserDetail,
  type AssignStaffInput,
  type CreateAdminUserInput,
  type CreateStaffInput,
  type UpdateAdminUserInput,
} from '@/features/admin/admin-users-api';
import type { Session } from '@/features/auth/session';

type MockApiRequest = {
  mock: { calls: unknown[][] };
  mockResolvedValue(value: unknown): void;
  mockResolvedValueOnce(value: unknown): void;
  mockRejectedValueOnce(value: unknown): void;
};

type TestFunction = {
  (title: string, run: () => void | Promise<void>): void;
  each<T>(cases: T[]): (title: string, run: (value: T) => void | Promise<void>) => void;
};

declare const jest: {
  clearAllMocks(): void;
  fn(): unknown;
  mock(moduleName: string, factory: () => unknown): void;
  requireActual<T>(moduleName: string): T;
};
declare const describe: (title: string, run: () => void) => void;
declare const beforeEach: (run: () => void) => void;
declare const test: TestFunction;
declare const expect: {
  (value: unknown): {
    toEqual(expected: unknown): void;
    toBe(expected: unknown): void;
    toHaveBeenCalledWith(...expected: unknown[]): void;
  };
  objectContaining(value: Record<string, unknown>): unknown;
};

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client') as typeof import('@/api/client');
  return { ...actual, apiRequest: jest.fn() };
});

const session: Session = {
  token: 'test-token',
  user: { user_id: 1, full_name: 'Admin', phone: '0912345678', role_id: 1 },
};
const mockedApiRequest = apiRequest as unknown as MockApiRequest;

const userInput: CreateAdminUserInput = {
  full_name: 'Nguyen Van A',
  phone: '0912345678',
  password: 'secret1',
  role_id: 3,
};
const staffInput: CreateStaffInput = {
  ...userInput,
  branch_id: 10,
  department_id: 20,
};
const userUpdate: UpdateAdminUserInput = { is_active: 0 };
const assignment: AssignStaffInput = {
  branch_id: 10,
  department_id: 20,
  room_id: null,
};
const staffDetail: AdminUserDetail = {
  user_id: 8,
  full_name: 'Staff',
  phone: '0987654321',
  role_id: 2,
  is_active: 1,
  branch_id: 10,
  department_id: 20,
  room_id: null,
};

const operations: {
  name: string;
  run: () => Promise<unknown>;
  method: string;
  url: string;
  successCode: string;
  data?: unknown;
}[] = [
  { name: 'create user', run: () => adminUsersApi.createUser(session, userInput), method: 'post', url: '/admin/users', successCode: '1001', data: userInput },
  { name: 'create staff', run: () => adminUsersApi.createStaff(session, staffInput), method: 'post', url: '/auth/admin/create-staff', successCode: '1001', data: staffInput },
  { name: 'get user', run: () => adminUsersApi.getUser(session, 8), method: 'get', url: '/admin/users/8', successCode: '1000' },
  { name: 'update user', run: () => adminUsersApi.updateUser(session, 8, userUpdate), method: 'put', url: '/admin/users/8', successCode: '1000', data: userUpdate },
  { name: 'delete user', run: () => adminUsersApi.deleteUser(session, 8), method: 'delete', url: '/admin/users/8', successCode: '1000' },
  { name: 'assign staff', run: () => adminUsersApi.assignStaff(session, 8, assignment), method: 'put', url: '/admin/users/8/assign', successCode: '1000', data: assignment },
];

describe('admin users API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(operations)('$name uses the documented method, path, token and success code', async ({ run, method, url, successCode, data }) => {
    mockedApiRequest.mockResolvedValueOnce({
      code: successCode,
      message: 'confirmed by server',
      data: {},
    });

    await run();

    expect(mockedApiRequest.mock.calls[0]).toEqual([
      expect.objectContaining({ method, url, ...(data === undefined ? {} : { data }) }),
      session.token,
    ]);
  });

  test('lists users using the documented pagination and optional role filter', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      code: '1000',
      message: 'OK',
      data: [],
      total: 0,
      page: 2,
      limit: 20,
    });
    const response = await adminUsersApi.listUsers(session, { page: 2, limit: 20, roleId: 3 });

    expect(mockedApiRequest.mock.calls[0]).toEqual([
      expect.objectContaining({
        method: 'get',
        url: '/admin/users',
        params: { page: 2, limit: 20, role_id: 3 },
      }),
      session.token,
    ]);
    expect([response.total, response.page, response.limit]).toEqual([0, 2, 20]);
  });

  test('preserves a real API failure rather than returning successful user data', async () => {
    const failure = new Error('Forbidden by server policy');
    mockedApiRequest.mockRejectedValueOnce(failure);
    let received: unknown;

    try {
      await adminUsersApi.listUsers(session, { page: 1, limit: 20 });
    } catch (cause) {
      received = cause;
    }

    expect(received).toBe(failure);
  });

  test('models staff assignment values including an explicitly unassigned room', () => {
    expect([staffDetail.branch_id, staffDetail.department_id, staffDetail.room_id, assignment.room_id])
      .toEqual([10, 20, null, null]);
  });
});
