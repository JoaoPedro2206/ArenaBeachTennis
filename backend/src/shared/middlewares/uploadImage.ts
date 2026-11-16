import multer from 'multer';
import { AppError } from '../errors/AppError';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Recebe UMA imagem em memória (campo multipart `fieldName`).
 * memoryStorage: o arquivo vira `req.file.buffer`, que o StorageProvider
 * envia para o disco local hoje e para S3/Cloudinary amanhã.
 */
export const uploadImage = (fieldName: string) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (_req, file, callback) => {
      if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) return callback(null, true);
      callback(new AppError('Formato não suportado. Envie JPG, PNG ou WebP.', 415, 'UNSUPPORTED_MEDIA_TYPE'));
    },
  }).single(fieldName);

/**
 * O Content-Type vem do cliente e pode mentir. Conferimos a "assinatura"
 * (primeiros bytes) para garantir que o arquivo é mesmo uma imagem.
 */
export function hasImageSignature(buffer: Buffer, mimetype: string): boolean {
  if (mimetype === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}
