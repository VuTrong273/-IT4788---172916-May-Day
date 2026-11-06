import {
  apiRequest,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type ImageAttachment = {
  id: string | number;
  medical_record_id?: string | number | null;
  question_id?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  created_at?: string;
};

export type AnswerImage = {
  id: string | number;
  answer_id?: string | number;
  attachment?: {
    attachment_id: string | number;
    file_url?: string | null;
    file_name?: string | null;
  };
  option_value?: string | null;
};

export type ImageFileMetadata = {
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  uri?: string;
};

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
const maxImageBytes = 5 * 1024 * 1024;
const maxImagesPerUpload = 10;

export function validateImageSelection(
  images: readonly ImageFileMetadata[],
  maxCount = maxImagesPerUpload,
): string | null {
  if (images.length === 0) return 'Hãy chọn ít nhất một ảnh.';
  if (images.length > maxCount) return `Mỗi lần chỉ được tải tối đa ${maxCount} ảnh.`;

  for (const image of images) {
    const name = image.fileName || image.uri || '';
    const extension = name.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase();
    const mimeType = image.mimeType?.toLowerCase();
    if (
      (mimeType && !allowedMimeTypes.has(mimeType)) ||
      (!mimeType && (!extension || !allowedExtensions.has(extension)))
    ) {
      return `${image.fileName || 'Ảnh đã chọn'} không đúng định dạng. Chỉ nhận JPG, JPEG, PNG hoặc WebP.`;
    }
    if (image.fileSize !== undefined && image.fileSize !== null && image.fileSize > maxImageBytes) {
      return `${image.fileName || 'Ảnh đã chọn'} vượt quá giới hạn 5 MB.`;
    }
  }
  return null;
}

function dataFor<T>(
  response: ApiEnvelope<T>,
  acceptedCodes: readonly string[],
  operation: string,
): T {
  return requireApiCode(response, acceptedCodes, operation).data;
}

function requireImageId<T extends { id?: string | number }>(
  image: T | null | undefined,
  operation: string,
): T {
  if (!image || image.id === undefined || image.id === null || String(image.id) === '') {
    throw new Error(`Máy chủ xác nhận ${operation} nhưng không trả về mã ảnh.`);
  }
  return image;
}

export const imageAttachmentsApi = {
  async uploadOne(
    session: Session,
    form: FormData,
  ): Promise<ImageAttachment> {
    const operation = 'POST /image-attachments/upload';
    const response = await apiRequest<ApiEnvelope<ImageAttachment>>(
      { method: 'post', url: '/image-attachments/upload', data: form },
      session.token,
    );
    return requireImageId(dataFor(response, ['1001'], operation), operation);
  },

  async uploadMultiple(
    session: Session,
    form: FormData,
  ): Promise<{ images: ImageAttachment[]; total?: string | number }> {
    const operation = 'POST /image-attachments/upload-multiple';
    const response = await apiRequest<
      ApiEnvelope<ImageAttachment[]> & { total?: string | number }
    >(
      { method: 'post', url: '/image-attachments/upload-multiple', data: form },
      session.token,
    );
    const images = dataFor(response, ['1001'], operation);
    if (!Array.isArray(images)) {
      throw new Error(`Máy chủ không trả về danh sách ảnh sau ${operation}.`);
    }
    return {
      images: images.map((image) => requireImageId(image, operation)),
      total: response.total,
    };
  },

  async listForUser(session: Session, userId: number): Promise<ImageAttachment[]> {
    const path = `/image-attachments/user/${encodeURIComponent(String(userId))}`;
    const response = await apiRequest<ApiEnvelope<ImageAttachment[]>>(
      { method: 'get', url: path },
      session.token,
    );
    const images = dataFor(response, ['1000'], `GET ${path}`);
    if (!Array.isArray(images)) throw new Error(`Máy chủ không trả về danh sách ảnh cho ${path}.`);
    return images;
  },

  async deleteAttachment(session: Session, id: string | number): Promise<void> {
    const path = `/image-attachments/${encodeURIComponent(String(id))}`;
    const response = await apiRequest<ApiEnvelope<Record<string, never>>>(
      { method: 'delete', url: path },
      session.token,
    );
    dataFor(response, ['1000'], `DELETE ${path}`);
  },

  async linkToAnswer(
    session: Session,
    input: { answer_id: number; attachment_id: string | number; option_value?: string },
  ): Promise<AnswerImage> {
    const response = await apiRequest<ApiEnvelope<AnswerImage>>(
      { method: 'post', url: '/answer-images', data: input },
      session.token,
    );
    return requireImageId(dataFor(response, ['1001'], 'POST /answer-images'), 'POST /answer-images');
  },

  async listForAnswer(session: Session, answerId: number): Promise<AnswerImage[]> {
    const path = `/answer-images/${encodeURIComponent(String(answerId))}`;
    const response = await apiRequest<ApiEnvelope<AnswerImage[]>>(
      { method: 'get', url: path },
      session.token,
    );
    const images = dataFor(response, ['1000'], `GET ${path}`);
    if (!Array.isArray(images)) throw new Error(`Máy chủ không trả về danh sách ảnh cho ${path}.`);
    return images;
  },

  async unlinkFromAnswer(session: Session, id: string | number): Promise<void> {
    const path = `/answer-images/${encodeURIComponent(String(id))}`;
    const response = await apiRequest<ApiEnvelope<Record<string, never>>>(
      { method: 'delete', url: path },
      session.token,
    );
    dataFor(response, ['1000'], `DELETE ${path}`);
  },
};
