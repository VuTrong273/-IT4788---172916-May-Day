import { isAxiosError } from 'axios';

import { apiClient, apiUrl } from '@/api/client';
import type { Session } from '@/features/auth/session';

export type TemplateItem = {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: '0' | '1';
  created_at: string;
};

export type TemplateInput = {
  code_template: string;
  name: string;
  description: string;
  version: string;
  is_active: '0' | '1';
};

function apiError(error: unknown): Error {
  if (isAxiosError<{ code?: string; message?: string }>(error)) {
    const code = error.response?.data?.code;
    if (code === '4102') return new Error('Mã mẫu phiếu đã tồn tại. Hãy chọn mã khác.');
    if (['3001', '3002', '3003'].includes(code ?? '')) return new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    return new Error(error.response?.data?.message || 'Không kết nối được backend. Hãy thử lại.');
  }
  return error instanceof Error ? error : new Error('Có lỗi xảy ra. Hãy thử lại.');
}

export const templatesApi = {
  async list(session: Session): Promise<TemplateItem[]> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.get<{ code: string; data: TemplateItem[] }>('/templates/all', {
        params: { page: 1, limit: 100 },
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (response.data.code !== '1000') throw new Error('Không tải được mẫu phiếu.');
      return response.data.data;
    } catch (error) { throw apiError(error); }
  },

  async create(session: Session, input: TemplateInput): Promise<TemplateItem> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.post<{ code: string; data: TemplateItem }>('/templates', input, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (response.data.code !== '1001') throw new Error('Không tạo được mẫu phiếu.');
      return response.data.data;
    } catch (error) { throw apiError(error); }
  },
};
