import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Hash "falso" usado quando o e-mail não existe no login, para que a
 * resposta leve o mesmo tempo e não revele quais e-mails estão cadastrados.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing', SALT_ROUNDS);
