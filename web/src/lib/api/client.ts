export type ApiEnvelope<T> = {
  code: string;
  message: string;
  data: T;
};

const configuredBase = import.meta.env.VITE_API_URL?.trim();
export const apiBaseUrl = (configuredBase || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...init } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', response.status);
  }

  const envelope = payload as Partial<ApiEnvelope<T>>;
  if (!response.ok || envelope.code !== '1000') {
    const code = typeof envelope.code === 'string' ? envelope.code : undefined;
    const message = typeof envelope.message === 'string' ? envelope.message : 'Không thể hoàn tất yêu cầu.';
    if (response.status === 401 || ['3001', '3002', '3003'].includes(code ?? '')) {
      throw new ApiError('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.', response.status, code);
    }
    throw new ApiError(message, response.status, code);
  }

  return envelope as ApiEnvelope<T> as T;
}

export function unwrapEnvelope<T>(value: unknown): T {
  const envelope = value as ApiEnvelope<T>;
  return envelope.data;
}
