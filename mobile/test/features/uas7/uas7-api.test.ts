import { apiRequest, requireApiCode } from '@/api/client';
import { uas7Api } from '@/features/uas7/uas7-api';
import type { Session } from '@/features/auth/session';

type MockFunction = {
  (...args: unknown[]): unknown;
  mockReset(): void;
  mockClear(): void;
  mockResolvedValue(value: unknown): MockFunction;
  mockResolvedValueOnce(value: unknown): MockFunction;
};

declare const jest: {
  mock(moduleName: string, factory: () => unknown): void;
  fn(implementation?: (...args: never[]) => unknown): MockFunction;
  mocked<T>(value: T): T & MockFunction;
};
declare const describe: (title: string, run: () => void) => void;
declare const beforeEach: (run: () => void) => void;
declare const test: (title: string, run: () => void | Promise<void>) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toHaveBeenCalledWith(...expected: unknown[]): void;
  toHaveBeenNthCalledWith(nth: number, ...expected: unknown[]): void;
  resolves: { toEqual(expected: unknown): Promise<void> };
};

jest.mock('@/api/client', () => ({
  apiRequest: jest.fn(),
  requireApiCode: jest.fn((response: { code: string }, acceptedCodes: readonly string[]) => {
    if (!acceptedCodes.includes(response.code)) {
      throw new Error(`Unexpected API code ${response.code}`);
    }
    return response;
  }),
  ApiRequestError: class ApiRequestError extends Error {},
}));

const session: Session = {
  token: 'server-issued-token',
  user: { user_id: 15, full_name: 'Bệnh nhân', phone: '0912345678', role_id: 3 },
};

const apiRequestMock = jest.mocked(apiRequest);
const requireApiCodeMock = jest.mocked(requireApiCode);

describe('UAS7 API client', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    requireApiCodeMock.mockClear();
  });

  test('reads eligibility and accepts only the contract success code', async () => {
    const data = { eligible: 'true' as const, medical_record_id: '101' };
    apiRequestMock.mockResolvedValue({ code: '1000', message: 'OK', data });

    await expect(uas7Api.eligibility(session)).resolves.toEqual(data);
    expect(apiRequestMock).toHaveBeenCalledWith(
      { method: 'get', url: '/uas7-scores/eligibility', data: undefined, params: undefined },
      session.token,
    );
    expect(requireApiCodeMock).toHaveBeenCalledWith(
      { code: '1000', message: 'OK', data },
      ['1000'],
      'GET /uas7-scores/eligibility',
    );
  });

  test('submits the server-backed record ID and string score fields', async () => {
    const score = {
      medical_record_id: '101',
      score_date: '2026-11-05',
      iss7: '2',
      hss7: '1',
    };
    const saved = {
      patient_id: '15',
      ...score,
      daily_score: '3',
    };
    apiRequestMock.mockResolvedValue({ code: '1001', message: 'Created', data: saved });

    await expect(uas7Api.create(session, score)).resolves.toEqual(saved);
    expect(apiRequestMock).toHaveBeenCalledWith(
      { method: 'post', url: '/uas7-scores', data: score, params: undefined },
      session.token,
    );
    expect(requireApiCodeMock).toHaveBeenCalledWith(
      { code: '1001', message: 'Created', data: saved },
      ['1001'],
      'POST /uas7-scores',
    );
  });

  test('requests patient history and the optional weekly start date', async () => {
    apiRequestMock.mockResolvedValueOnce({ code: '1000', message: 'OK', data: [] });
    apiRequestMock.mockResolvedValueOnce({
      code: '1000',
      message: 'OK',
      data: { patient_id: '15', week_score: '18', severity_label: 'Nặng', completed_days: '7' },
    });

    await expect(uas7Api.history(session, 15)).resolves.toEqual([]);
    await expect(uas7Api.week(session, 15, '2026-11-01')).resolves.toEqual({
      patient_id: '15',
      week_score: '18',
      severity_label: 'Nặng',
      completed_days: '7',
    });
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      { method: 'get', url: '/uas7-scores/patient/15', data: undefined, params: undefined },
      session.token,
    );
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      { method: 'get', url: '/uas7-scores/week/15', data: undefined, params: { start_date: '2026-11-01' } },
      session.token,
    );
  });
});
