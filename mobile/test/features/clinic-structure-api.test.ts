import { apiRequest } from '@/api/client';
import {
  clinicStructureApi,
  type Branch,
  type Department,
  type Room,
} from '@/features/clinic-structure/clinic-structure-api';
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
    toHaveBeenNthCalledWith(index: number, ...expected: unknown[]): void;
  };
  objectContaining(value: Record<string, unknown>): unknown;
};

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client') as typeof import('@/api/client');
  return { ...actual, apiRequest: jest.fn() };
});

const session: Session = {
  token: 'test-token',
  user: { user_id: 1, full_name: 'Admin', phone: '123', role_id: 1 },
};

const mockedApiRequest = apiRequest as unknown as MockApiRequest;

const operations: Array<{
  name: string;
  run: () => Promise<unknown>;
  method: string;
  url: string;
  successCode: string;
}> = [
  { name: 'create branch', run: () => clinicStructureApi.createBranch(session, { name: 'A', address: 'B', phone: 'C' }), method: 'post', url: '/branches', successCode: '1001' },
  { name: 'list branches', run: () => clinicStructureApi.listBranches(session), method: 'get', url: '/branches', successCode: '1000' },
  { name: 'get branch', run: () => clinicStructureApi.getBranch(session, 7), method: 'get', url: '/branches/7', successCode: '1000' },
  { name: 'update branch', run: () => clinicStructureApi.updateBranch(session, 7, { name: 'A' }), method: 'put', url: '/branches/7', successCode: '1000' },
  { name: 'delete branch', run: () => clinicStructureApi.deleteBranch(session, 7), method: 'delete', url: '/branches/7', successCode: '1000' },
  { name: 'create department', run: () => clinicStructureApi.createDepartment(session, { name: 'A', branch_id: 2 }), method: 'post', url: '/departments', successCode: '1001' },
  { name: 'list departments', run: () => clinicStructureApi.listDepartments(session), method: 'get', url: '/departments', successCode: '1000' },
  { name: 'get department', run: () => clinicStructureApi.getDepartment(session, 7), method: 'get', url: '/departments/7', successCode: '1000' },
  { name: 'update department', run: () => clinicStructureApi.updateDepartment(session, 7, { name: 'A' }), method: 'put', url: '/departments/7', successCode: '1000' },
  { name: 'delete department', run: () => clinicStructureApi.deleteDepartment(session, 7), method: 'delete', url: '/departments/7', successCode: '1000' },
  { name: 'create room', run: () => clinicStructureApi.createRoom(session, { name: 'A', department_id: 2 }), method: 'post', url: '/rooms', successCode: '1001' },
  { name: 'list rooms', run: () => clinicStructureApi.listRooms(session), method: 'get', url: '/rooms', successCode: '1000' },
  { name: 'get room', run: () => clinicStructureApi.getRoom(session, 7), method: 'get', url: '/rooms/7', successCode: '1000' },
  { name: 'update room', run: () => clinicStructureApi.updateRoom(session, 7, { name: 'A' }), method: 'put', url: '/rooms/7', successCode: '1000' },
  { name: 'delete room', run: () => clinicStructureApi.deleteRoom(session, 7), method: 'delete', url: '/rooms/7', successCode: '1000' },
];

describe('clinic structure API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(operations)('$name uses the documented method, path, and success code', async ({ run, method, url, successCode }) => {
    mockedApiRequest.mockResolvedValueOnce({
      code: successCode,
      message: 'confirmed by server',
      data: {},
    });

    await run();

    expect(mockedApiRequest.mock.calls[0]).toEqual([
      expect.objectContaining({ method, url }),
      session.token,
    ]);
  });

  test('filters departments and rooms only with contract parent IDs', async () => {
    mockedApiRequest.mockResolvedValue({
      code: '1000',
      message: 'OK',
      data: [],
    });

    await clinicStructureApi.listDepartments(session, 3);
    await clinicStructureApi.listRooms(session, 9);

    expect(mockedApiRequest.mock.calls).toEqual([
      [expect.objectContaining({ url: '/departments', params: { branch_id: 3 } }), session.token],
      [expect.objectContaining({ url: '/rooms', params: { department_id: 9 } }), session.token],
    ]);
  });

  test('propagates an API failure instead of converting it to successful data', async () => {
    const failure = new Error('Forbidden by server policy');
    mockedApiRequest.mockRejectedValueOnce(failure);
    let received: unknown;

    try {
      await clinicStructureApi.listBranches(session);
    } catch (cause) {
      received = cause;
    }

    expect(received).toBe(failure);
  });

  test('models the documented related entity fields', () => {
    const branch: Branch = { id: 1, name: 'Cơ sở', address: 'Đường', phone: '123' };
    const department: Department = { id: 2, name: 'Khoa', branch_id: branch.id };
    const room: Room = { id: 3, name: 'Phòng', department_id: department.id };

    expect([branch.name, department.branch_id, room.department_id]).toEqual(['Cơ sở', 1, 2]);
  });
});
