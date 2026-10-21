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

export const authApi = {
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
};
