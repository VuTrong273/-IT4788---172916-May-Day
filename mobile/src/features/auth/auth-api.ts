import { isAxiosError } from 'axios';

import { apiClient, apiUrl } from '@/api/client';

import type { LoginFormValues } from './login-schema';

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
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');

    try {
      const response = await apiClient.post<SignupResponse>('/auth/signup', values);
      if (response.data.code !== '1001') {
        throw new Error(response.data.message || 'Đăng ký thất bại.');
      }
      return response.data;
    } catch (error) {
      if (isAxiosError<{ code?: string; message?: string }>(error)) {
        if (error.response?.data?.code === '3006') {
          throw new Error('Số điện thoại này đã được đăng ký.');
        }
        throw new Error(
          error.response?.data?.message ??
            'Không kết nối được backend. Hãy kiểm tra mạng và địa chỉ API.',
        );
      }
      throw error;
    }
  },
  async login(values: LoginFormValues): Promise<LoginResponse> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');

    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', values);

      if (response.data.code !== '1000') {
        throw new Error(response.data.message || 'Đăng nhập thất bại.');
      }

      return response.data;
    } catch (error) {
      if (isAxiosError<{ message?: string }>(error)) {
        throw new Error(
          error.response?.data?.message ??
            'Không kết nối được backend. Hãy kiểm tra mạng và địa chỉ API.',
        );
      }
      throw error;
    }
  },
  async logout(token: string): Promise<void> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');

    try {
      await apiClient.post(
        '/auth/logout',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (error) {
      if (isAxiosError(error)) {
        throw new Error('Không thể xác nhận đăng xuất với backend.');
      }
      throw error;
    }
  },
  async changePassword(token: string, values: ChangePasswordRequest): Promise<void> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');

    try {
      const response = await apiClient.put<{ code: string; message: string }>(
        '/auth/change-password',
        values,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.code !== '1000') {
        throw new Error(response.data.message || 'Đổi mật khẩu thất bại.');
      }
    } catch (error) {
      if (isAxiosError<{ code?: string; message?: string }>(error)) {
        if (error.response?.data?.code === '3009') {
          throw new Error('Mật khẩu hiện tại không đúng.');
        }
        if (error.response?.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        throw new Error(
          error.response?.data?.message ??
            'Không kết nối được backend. Hãy kiểm tra mạng và địa chỉ API.',
        );
      }
      throw error;
    }
  },
};

async function authRequest(path: string, body: object, token?: string): Promise<void> {
  if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
  try {
    const response = await apiClient.post<{ code: string; message: string }>(
      path,
      body,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    );
    if (response.data.code !== '1000') {
      throw new Error(response.data.message || 'Yêu cầu thất bại.');
    }
  } catch (error) {
    if (isAxiosError<{ code?: string; message?: string }>(error)) {
      const code = error.response?.data?.code;
      if (code === '3004') throw new Error('Mã OTP không đúng.');
      if (code === '3005') throw new Error('Mã OTP đã hết hạn. Hãy yêu cầu mã mới.');
      if (code === '3009') throw new Error('Mật khẩu hiện tại không đúng.');
      if (code === '9903') throw new Error('Không gửi được email. Hãy kiểm tra cấu hình Gmail hoặc thử lại.');
      throw new Error(error.response?.data?.message ?? 'Không kết nối được backend.');
    }
    throw error;
  }
}
