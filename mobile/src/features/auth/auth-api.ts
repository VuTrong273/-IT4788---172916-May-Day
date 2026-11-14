import { apiRequest, ApiRequestError, requireApiCode } from '@/api/client';

import type { LoginFormValues } from './login-schema';
import { getAuthenticatedRole } from './roles';

type LoginResponse = {
  code: string;
  message: string;
  data: {
    token: string;
    user_info: {
      user_id: number;
      full_name: string;
      phone: string;
      role_id: number;
    };
  };
};

type SignupRequest = {
  full_name: string;
  phone: string;
  password: string;
  gender?: 'male' | 'female' | 'other';
  year_of_birth?: number;
};

type SignupResponse = {
  code: string;
  message: string;
  data: {
    user_id: number;
    full_name: string;
    phone: string;
    role_id: number;
  };
};

type ChangePasswordRequest = {
  old_password: string;
  new_password: string;
  confirm_password: string;
};

function translatedFailure(error: unknown): Error {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error ? error : new Error('Yêu cầu thất bại.');
  }

  let message: string | undefined;
  switch (error.apiCode) {
    case '3004':
      message = 'Mã OTP không đúng.';
      break;
    case '3005':
      message = 'Mã OTP đã hết hạn. Hãy yêu cầu mã mới.';
      break;
    case '3006':
      message = 'Số điện thoại này đã được đăng ký.';
      break;
    case '3009':
      message = 'Mật khẩu hiện tại không đúng.';
      break;
    case '9903':
      message = 'Không gửi được email. Hãy kiểm tra cấu hình gửi thư hoặc thử lại.';
      break;
    default:
      if (error.status === 401) {
        message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      }
  }

  return message
    ? new ApiRequestError({
        kind: error.kind,
        status: error.status,
        apiCode: error.apiCode,
        operation: error.operation,
        retryable: error.retryable,
        message,
      })
    : error;
}

export function isExpiredAuthSession(error: unknown): boolean {
  return error instanceof ApiRequestError &&
    (error.status === 401 || ['3001', '3002', '3003'].includes(error.apiCode ?? ''));
}

export function shouldClearAuthSecrets(error: unknown): boolean {
  return error instanceof ApiRequestError &&
    (error.status === 401 ||
      ['3004', '3005', '3008', '3009', '3010'].includes(error.apiCode ?? ''));
}

async function authRequest<T extends { code?: unknown; message?: unknown }>(
  path: string,
  body: object,
  token?: string,
): Promise<T> {
  try {
    const response = await apiRequest<T>(
      { method: 'post', url: path, data: body },
      token,
    );
    return requireApiCode(response, ['1000'], `POST ${path}`);
  } catch (error) {
    throw translatedFailure(error);
  }
}

export const authApi = {
  async requestRecoveryEmail(token: string, email: string, password: string): Promise<void> {
    await authRequest('/auth/recovery-email', { email, password }, token);
  },
  async verifyRecoveryEmail(token: string, otp: string): Promise<void> {
    await authRequest('/auth/recovery-email/verify', { otp }, token);
  },
  async forgotPassword(email: string): Promise<void> {
    await authRequest('/auth/forgot-password', { email });
  },
  async resetPassword(values: {
    email: string;
    otp: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    await authRequest('/auth/reset-password', values);
  },
  async signup(values: SignupRequest): Promise<SignupResponse> {
    try {
      const response = await apiRequest<SignupResponse>({
        method: 'post',
        url: '/auth/signup',
        data: values,
      });
      return requireApiCode(response, ['1001'], 'POST /auth/signup');
    } catch (error) {
      throw translatedFailure(error);
    }
  },
  async login(values: LoginFormValues): Promise<LoginResponse> {
    try {
      const response = await apiRequest<LoginResponse>({
        method: 'post',
        url: '/auth/login',
        data: values,
      });
      requireApiCode(response, ['1000'], 'POST /auth/login');

      const identity = response.data?.user_info;
      if (
        !response.data?.token ||
        !Number.isInteger(identity?.user_id) ||
        identity.user_id <= 0 ||
        !getAuthenticatedRole(identity.role_id)
      ) {
        throw new ApiRequestError({
          kind: 'api',
          operation: 'POST /auth/login',
          message: 'Tài khoản không có thông tin vai trò được hỗ trợ.',
        });
      }
      return response;
    } catch (error) {
      throw translatedFailure(error);
    }
  },
  async logout(token: string): Promise<void> {
    try {
      const response = await apiRequest<{ code: string; message: string }>(
        { method: 'post', url: '/auth/logout', data: {} },
        token,
      );
      requireApiCode(response, ['1000'], 'POST /auth/logout');
    } catch (error) {
      throw translatedFailure(error);
    }
  },
  async changePassword(token: string, values: ChangePasswordRequest): Promise<void> {
    try {
      const response = await apiRequest<{ code: string; message: string }>({
        method: 'put',
        url: '/auth/change-password',
        data: values,
      }, token);
      requireApiCode(response, ['1000'], 'PUT /auth/change-password');
    } catch (error) {
      throw translatedFailure(error);
    }
  },
};
