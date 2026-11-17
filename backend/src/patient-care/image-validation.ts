import { fail } from '../common/database.service.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_IMAGES = 10;
export const IMAGE_LINK_TTL_SECONDS = 3600;
export const IMAGE_UPLOAD_LIMITS = {
  fileSize: MAX_IMAGE_BYTES,
  files: MAX_UPLOAD_IMAGES,
  fields: 5,
  fieldSize: 2048,
};

export interface UploadedImage {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

function detectImageType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return 'image/jpeg';
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export function validateUploadedImages(files: UploadedImage[]): void {
  if (!files.length || files.length > MAX_UPLOAD_IMAGES)
    fail('6002', 'Select between 1 and 10 images');
  for (const file of files) {
    const type = detectImageType(file.buffer);
    if (
      !type ||
      type !== file.mimetype ||
      file.size > MAX_IMAGE_BYTES ||
      file.size === 0
    ) {
      fail('6002', 'Only JPG, PNG and WebP images up to 5 MB are accepted');
    }
  }
}
