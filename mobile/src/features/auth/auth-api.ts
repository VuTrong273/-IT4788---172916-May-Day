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

async function demoLogin(values: LoginFormValues): Promise<LoginResponse> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (values.phone !== '0912345678' || values.password !== '123456') {
    throw new Error('Tài khoản demo không đúng. Hãy dùng 0912345678 / 123456.');
  }

  return {
    code: '1000',
    message: 'OK',
    data: {
      token: 'demo-token',
      user_info: {
        user_id: 15,
        full_name: 'Nguyễn Văn A',
        phone: values.phone,
        role_id: 3,
      },
    },
  };
}

export const authApi = {
  async login(values: LoginFormValues): Promise<LoginResponse> {
    if (!apiUrl) {
      if (__DEV__) return demoLogin(values);
      throw new Error('Chưa cấu hình địa chỉ backend.');
    }

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
    if (token === 'demo-token') return;
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
};
