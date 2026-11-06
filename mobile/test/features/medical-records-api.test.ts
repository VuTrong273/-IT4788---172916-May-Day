import { ApiRequestError } from '@/api/client';
import { medicalRecordsApi } from '@/features/doctor/medical-records-api';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => { toBe(expected: unknown): void };

describe('medical-record API input validation', () => {
  test('refuses to submit an empty answers collection', async () => {
    let caught: unknown;
    try {
      await medicalRecordsApi.saveAnswers(
        {
          token: 'test-token',
          user: { user_id: 15, full_name: 'Test', phone: '000', role_id: 3 },
        },
        101,
        [],
      );
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof ApiRequestError).toBe(true);
    expect(caught instanceof ApiRequestError ? caught.apiCode : null).toBe('4007');
  });
});
