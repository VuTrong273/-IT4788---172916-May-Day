import { apiRequest, unwrapEnvelope } from '@/lib/api/client';
import type { AuthUser, Session } from './auth-types';

type LoginResponse = {
  code: string;
  message: string;
  data: { token: string; user_info: AuthUser };
};

export const authApi = {
  async login(phone: string, password: string): Promise<Session> {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    return { token: response.data.token, user: response.data.user_info };
  },
  async logout(token: string): Promise<void> {
    await apiRequest('/auth/logout', { method: 'POST', body: '{}', token });
  },
  async changePassword(token: string, values: { old_password: string; new_password: string; confirm_password: string }) {
    return apiRequest('/auth/change-password', { method: 'PUT', body: JSON.stringify(values), token });
  },
  async forgotPassword(email: string) {
    return apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },
  async resetPassword(values: { email: string; otp: string; new_password: string; confirm_password: string }) {
    return apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(values) });
  },
};

export function getProfile<T>(token: string): Promise<T> {
  return apiRequest('/profile', { token }).then((response) => unwrapEnvelope<T>(response));
}

export function updateProfile<T>(token: string, changes: { full_name: string }): Promise<T> {
  return apiRequest('/profile', { method: 'PUT', body: JSON.stringify(changes), token })
    .then((response) => unwrapEnvelope<T>(response));
}
