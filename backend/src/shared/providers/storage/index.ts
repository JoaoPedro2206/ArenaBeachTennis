import path from 'node:path';
import { LocalDiskStorageProvider } from './LocalDiskStorageProvider';
import type { StorageProvider } from './StorageProvider';

/** Pasta física dos uploads locais e prefixo público servido pelo Express */
export const UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads');
export const UPLOADS_PUBLIC_PATH = '/uploads';

/**
 * Ponto único de escolha do provedor. Para produção:
 *   export const storage: StorageProvider = new S3StorageProvider({ bucket: env.S3_BUCKET, ... });
 */
export const storage: StorageProvider = new LocalDiskStorageProvider(UPLOADS_DIR, UPLOADS_PUBLIC_PATH);

export type { StorageProvider, UploadFile } from './StorageProvider';
