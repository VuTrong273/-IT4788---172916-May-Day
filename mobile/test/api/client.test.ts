import {
  ApiRequestError,
  normalizeApiBaseUrl,
  toApiRequestError,
} from '@/api/client';

describe('shared API transport configuration and error handling', () => {
  test('normalizes an origin to one versioned API base path', () => {
    expect(normalizeApiBaseUrl('https://api.example.test')).toBe(
      'https://api.example.test/api/v1',
    );
    expect(normalizeApiBaseUrl('https://api.example.test/root/')).toBe(
      'https://api.example.test/root/api/v1',
    );
    expect(normalizeApiBaseUrl('https://api.example.test/api/v1/')).toBe(
      'https://api.example.test/api/v1',
    );
  });

  test('rejects non-absolute URLs and URLs containing query or credential data', () => {
    expect(() => normalizeApiBaseUrl('/api/v1')).toThrow();
    expect(() => normalizeApiBaseUrl('https://user:pass@example.test')).toThrow();
    expect(() => normalizeApiBaseUrl('https://example.test?token=unsafe')).toThrow();
  });

  test('keeps HTTP status and API code and marks transient server failures retryable', () => {
    const mapped = toApiRequestError(
      {
        isAxiosError: true,
        response: {
          status: 503,
          data: { code: '9902', message: 'Dịch vụ tạm thời không khả dụng.' },
        },
      },
      'GET /profile',
    );

    expect(mapped).toBeInstanceOf(ApiRequestError);
    expect(mapped.kind).toBe('http');
    expect(mapped.status).toBe(503);
    expect(mapped.apiCode).toBe('9902');
    expect(mapped.operation).toBe('GET /profile');
    expect(mapped.retryable).toBe(true);
    expect(mapped.message).toBe('Dịch vụ tạm thời không khả dụng.');
  });

  test('identifies timeouts without exposing transport internals', () => {
    const mapped = toApiRequestError({
      isAxiosError: true,
      code: 'ECONNABORTED',
    });

    expect(mapped.kind).toBe('timeout');
    expect(mapped.retryable).toBe(true);
    expect(mapped.message).not.toContain('ECONNABORTED');
  });

});
