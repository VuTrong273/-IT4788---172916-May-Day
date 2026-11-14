import { ApiRequestError } from '@/api/client';
import { clinicalApi } from '@/features/clinical/clinical-api';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => { toBe(expected: unknown): void };

const session = {
  token: 'test-token',
  user: { user_id: 8, full_name: 'Test', phone: '000', role_id: 2 },
};

describe('clinical API input validation', () => {
  test('refuses prescription requests without medicine items', async () => {
    let caught: unknown;
    try {
      await clinicalApi.createPrescription(session, 101, { items: [] });
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof ApiRequestError).toBe(true);
    expect(caught instanceof ApiRequestError ? caught.apiCode : null).toBe('8001');
  });

  test('refuses lab requests without test items', async () => {
    let caught: unknown;
    try {
      await clinicalApi.createLabRequest(session, 101, { items: [] });
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof ApiRequestError).toBe(true);
    expect(caught instanceof ApiRequestError ? caught.apiCode : null).toBe('8101');
  });

  test('refuses lab results with no result values', async () => {
    let caught: unknown;
    try {
      await clinicalApi.enterLabResults(session, { lab_request_id: '6', results: [] });
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof ApiRequestError).toBe(true);
    expect(caught instanceof ApiRequestError ? caught.apiCode : null).toBe('2001');
  });
});
