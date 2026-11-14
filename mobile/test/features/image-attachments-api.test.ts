import { validateImageSelection } from '@/features/records/image-attachments-api';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => {
  toBe(expected: unknown): void;
};

describe('image attachment selection validation', () => {
  test('accepts supported image types within the 5 MB limit', () => {
    expect(validateImageSelection([{
      fileName: 'photo.webp',
      mimeType: 'image/webp',
      fileSize: 1024,
    }])).toBe(null);
  });

  test('rejects unsupported image formats', () => {
    expect(validateImageSelection([{
      fileName: 'photo.gif',
      mimeType: 'image/gif',
      fileSize: 1024,
    }])).toBe('photo.gif không đúng định dạng. Chỉ nhận JPG, JPEG, PNG hoặc WebP.');
  });

  test('rejects images larger than 5 MB', () => {
    expect(validateImageSelection([{
      fileName: 'large.jpg',
      mimeType: 'image/jpeg',
      fileSize: 5 * 1024 * 1024 + 1,
    }])).toBe('large.jpg vượt quá giới hạn 5 MB.');
  });

  test('enforces the multiple-upload count limit', () => {
    const files = Array.from({ length: 11 }, (_, index) => ({
      fileName: `photo-${index}.jpg`,
      mimeType: 'image/jpeg',
    }));
    expect(validateImageSelection(files, 10)).toBe('Mỗi lần chỉ được tải tối đa 10 ảnh.');
  });
});
