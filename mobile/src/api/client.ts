import axios, {
  AxiosHeaders,
  isAxiosError,
  type AxiosRequestConfig,
} from 'axios';

export const API_TIMEOUT_MS = 10_000;

export type ApiRequestErrorKind =
  | 'configuration'
  | 'network'
  | 'timeout'
  | 'http'
  | 'api';

export class ApiRequestError extends Error {
  readonly kind: ApiRequestErrorKind;
  readonly status: number | null;
  readonly apiCode: string | null;
  readonly operation: string;
  readonly retryable: boolean;

  constructor(options: {
    kind: ApiRequestErrorKind;
    message: string;
    operation: string;
    status?: number | null;
    apiCode?: string | null;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = 'ApiRequestError';
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.apiCode = options.apiCode ?? null;
    this.operation = options.operation;
    this.retryable = options.retryable ?? false;
  }
}

export type ApiEnvelope<T> = {
  code: string;
  message: string;
  data: T;
};

function operationFor(config?: AxiosRequestConfig): string {
  const method = (config?.method ?? 'GET').toUpperCase();
  const path = (config?.url ?? '/').split('?')[0] || '/';
  return `${method} ${path}`;
}

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return text ? text.slice(0, 300) : null;
}

function responseCode(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : null;
}

function responseMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  return safeText((value as { message?: unknown }).message);
}

/**
 * Accept either an origin or a URL already ending in /api/v1.
 * The API prefix is added once so native and web callers share one route base.
 */
export function normalizeApiBaseUrl(value: string | undefined): string | undefined {
  const configured = value?.trim();
  if (!configured) return undefined;

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('API URL must be an absolute HTTP or HTTPS URL.');
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('API URL must be an absolute HTTP or HTTPS URL without credentials or query data.');
  }

  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = /\/api\/v1$/i.test(path) ? path : `${path}/api/v1`;
  return url.toString().replace(/\/+$/, '');
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
let apiUrl: string | undefined;
let apiConfigurationProblem = false;
try {
  apiUrl = normalizeApiBaseUrl(configuredApiUrl);
} catch {
  // Keep the app bootable; requests expose the configuration error to the UI.
  apiConfigurationProblem = true;
}

export { apiUrl };

export const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: API_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

export function toApiRequestError(
  error: unknown,
  operation = 'GET /',
): ApiRequestError {
  if (error instanceof ApiRequestError) return error;

  if (isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const apiCode = responseCode(error.response?.data);
    const serverMessage = responseMessage(error.response?.data);

    if (status !== null) {
      return new ApiRequestError({
        kind: 'http',
        status,
        apiCode,
        operation,
        retryable: status === 408 || status === 425 || status === 429 || status >= 500,
        message: serverMessage ?? `Yêu cầu thất bại với mã HTTP ${status}.`,
      });
    }

    if (error.code === 'ERR_CANCELED') {
      return new ApiRequestError({
        kind: 'network',
        operation,
        retryable: false,
        message: 'Yêu cầu đã bị hủy.',
      });
    }

    const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    return new ApiRequestError({
      kind: timedOut ? 'timeout' : 'network',
      operation,
      retryable: true,
      message: timedOut
        ? 'Yêu cầu đã quá thời gian chờ. Hãy kiểm tra kết nối rồi thử lại.'
        : 'Không kết nối được máy chủ. Hãy kiểm tra mạng và địa chỉ API.',
    });
  }

  return new ApiRequestError({
    kind: 'network',
    operation,
    retryable: false,
    message: 'Không thể hoàn tất yêu cầu. Hãy thử lại.',
  });
}

export async function apiRequest<T>(
  config: AxiosRequestConfig,
  accessToken?: string,
): Promise<T> {
  const operation = operationFor(config);
  if (apiConfigurationProblem) {
    throw new ApiRequestError({
      kind: 'configuration',
      operation,
      message: 'Địa chỉ API chưa hợp lệ. Hãy kiểm tra EXPO_PUBLIC_API_URL.',
    });
  }
  if (!apiUrl) {
    throw new ApiRequestError({
      kind: 'configuration',
      operation,
      message: 'Chưa cấu hình địa chỉ backend (EXPO_PUBLIC_API_URL).',
    });
  }

  const headers = new AxiosHeaders();
  for (const [name, value] of Object.entries(config.headers ?? {})) {
    if (value !== undefined && value !== null) {
      headers.set(name, typeof value === 'string' ? value : String(value));
    }
  }
  headers.set('Accept', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (
    typeof FormData !== 'undefined' &&
    config.data instanceof FormData
  ) {
    // Let the platform/Axios set the multipart boundary for this FormData.
    headers.delete('Content-Type');
  }

  try {
    const response = await apiClient.request<T>({
      ...config,
      headers,
    });
    return response.data;
  } catch (error) {
    throw toApiRequestError(error, operation);
  }
}

export function requireApiCode<T extends { code?: unknown; message?: unknown }>(
  response: T,
  acceptedCodes: readonly string[],
  operation: string,
): T {
  const code = responseCode(response);
  if (code && acceptedCodes.includes(code)) return response;

  throw new ApiRequestError({
    kind: 'api',
    operation,
    apiCode: code,
    message:
      responseMessage(response) ??
      'Máy chủ không xác nhận yêu cầu thành công.',
  });
}
