import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider, StoredFile, UploadFile } from './StorageProvider';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Armazenamento em disco — APENAS para desenvolvimento.
 * Em produção os servidores são efêmeros/escalonados: use S3 ou Cloudinary
 * (ver StorageProvider.ts).
 */
export class LocalDiskStorageProvider implements StorageProvider {
  constructor(
    /** Pasta física (ex.: backend/uploads) */
    private readonly rootDir: string,
    /** Prefixo público servido pelo Express (ex.: /uploads) */
    private readonly publicPath: string,
  ) {}

  async save(file: UploadFile, folder: string): Promise<StoredFile> {
    // Nome gerado no servidor: nunca usamos o nome enviado pelo cliente (path traversal)
    const fileName = `${randomUUID()}.${EXTENSIONS[file.mimetype] ?? 'bin'}`;
    const dir = path.join(this.rootDir, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), file.buffer);
    return { url: `${this.publicPath}/${folder}/${fileName}` };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(`${this.publicPath}/`)) return; // não é um arquivo nosso
    const relative = url.slice(this.publicPath.length + 1);
    const target = path.resolve(this.rootDir, relative);
    if (!target.startsWith(path.resolve(this.rootDir) + path.sep)) return; // defesa contra "../"
    await unlink(target).catch(() => undefined);
  }
}
