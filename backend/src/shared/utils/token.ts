import { createHash, randomBytes } from 'node:crypto';

/** Token opaco de 32 bytes (256 bits), seguro para usar em URL. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 em hex (64 chars). É isto — nunca o token — que vai para o banco. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
