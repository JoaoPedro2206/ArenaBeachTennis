import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService, PASSWORD_RESET_TTL_MINUTES } from '../src/modules/auth/auth.service';
import { hashToken } from '../src/shared/utils/token';
import { FakeDb, FakeMailer } from './helpers/fakes';

const T0 = new Date('2026-11-18T12:00:00Z');

describe('recuperação de senha e verificação de e-mail (AuthService)', () => {
  let db: FakeDb;
  let mailer: FakeMailer;
  let clock: Date;
  let service: AuthService;

  beforeEach(() => {
    db = new FakeDb();
    mailer = new FakeMailer();
    clock = T0;
    service = new AuthService({
      users: db.usersPort,
      tokens: db.tokensStore,
      mailer,
      now: () => clock,
      hashPassword: async (plain) => `hashed:${plain}`,
    });
  });

  const advance = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));

  describe('forgot-password', () => {
    it('e-mail existente: envia o link e grava só o hash SHA-256', async () => {
      db.addUser({ email: 'maria@x.com' });
      await service.requestPasswordReset('maria@x.com');

      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].to).toBe('maria@x.com');
      const token = mailer.lastToken();
      expect(token.length).toBeGreaterThanOrEqual(43); // 32 bytes em base64url

      expect(db.tokens).toHaveLength(1);
      expect(db.tokens[0].tokenHash).toBe(hashToken(token));
      expect(JSON.stringify(db.tokens)).not.toContain(token);
      expect(db.tokens[0].expiresAt.getTime() - T0.getTime()).toBe(PASSWORD_RESET_TTL_MINUTES * 60_000);
    });

    it('e-mail inexistente: não lança, não envia e não grava nada', async () => {
      await expect(service.requestPasswordReset('ninguem@x.com')).resolves.toBeUndefined();
      expect(mailer.sent).toHaveLength(0);
      expect(db.tokens).toHaveLength(0);
    });

    it('conta desativada não recebe link', async () => {
      db.addUser({ email: 'off@x.com', isActive: false });
      await service.requestPasswordReset('off@x.com');
      expect(mailer.sent).toHaveLength(0);
    });

    it('novo pedido invalida o link anterior', async () => {
      db.addUser({ email: 'maria@x.com' });
      await service.requestPasswordReset('maria@x.com');
      const first = mailer.lastToken();
      await service.requestPasswordReset('maria@x.com');

      await expect(service.resetPassword(first, 'NovaSenha1')).rejects.toMatchObject({ code: 'LINK_USED' });
      await expect(service.resetPassword(mailer.lastToken(), 'NovaSenha1')).resolves.toBeUndefined();
    });

    it('rate limit por e-mail: excedente é ignorado em silêncio, sem erro', async () => {
      db.addUser({ email: 'maria@x.com' });
      for (let i = 0; i < 6; i++) await expect(service.requestPasswordReset('maria@x.com')).resolves.toBeUndefined();
      expect(mailer.sent).toHaveLength(3); // limite de 3 por janela

      advance(16); // janela passou
      await service.requestPasswordReset('maria@x.com');
      expect(mailer.sent).toHaveLength(4);
    });
  });

  describe('reset-password', () => {
    async function requestToken() {
      const user = db.addUser({ email: 'maria@x.com' });
      await service.requestPasswordReset('maria@x.com');
      return { user, token: mailer.lastToken() };
    }

    it('token válido troca a senha, marca como usado e incrementa tokenVersion', async () => {
      const { user, token } = await requestToken();
      await service.resetPassword(token, 'NovaSenha1');

      expect(user.passwordHash).toBe('hashed:NovaSenha1');
      expect(user.tokenVersion).toBe(1);
      expect(db.tokens[0].usedAt).toEqual(clock);
    });

    it('token reutilizado é recusado', async () => {
      const { user, token } = await requestToken();
      await service.resetPassword(token, 'NovaSenha1');
      await expect(service.resetPassword(token, 'OutraSenha2')).rejects.toMatchObject({
        statusCode: 400,
        code: 'LINK_USED',
      });
      expect(user.passwordHash).toBe('hashed:NovaSenha1');
      expect(user.tokenVersion).toBe(1);
    });

    it('token expirado (30 min) é recusado e não altera a senha', async () => {
      const { user, token } = await requestToken();
      advance(PASSWORD_RESET_TTL_MINUTES + 1);
      await expect(service.resetPassword(token, 'NovaSenha1')).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
      expect(user.passwordHash).toBe('old-hash');
      expect(user.tokenVersion).toBe(0);
    });

    it('ainda vale pouco antes dos 30 min', async () => {
      const { token } = await requestToken();
      advance(PASSWORD_RESET_TTL_MINUTES - 1);
      await expect(service.resetPassword(token, 'NovaSenha1')).resolves.toBeUndefined();
    });

    it('token inexistente/adulterado é recusado', async () => {
      await requestToken();
      await expect(service.resetPassword('x'.repeat(43), 'NovaSenha1')).rejects.toMatchObject({ code: 'LINK_INVALID' });
    });

    it('token de verificação de e-mail não serve para redefinir senha', async () => {
      const user = db.addUser({ email: 'novo@x.com' });
      await service.resendVerification(user.id);
      await expect(service.resetPassword(mailer.lastToken(), 'NovaSenha1')).rejects.toMatchObject({
        code: 'LINK_INVALID',
      });
    });

    it('duas requisições simultâneas com o mesmo link: só uma vence', async () => {
      const { token } = await requestToken();
      const results = await Promise.allSettled([
        service.resetPassword(token, 'SenhaA123'),
        service.resetPassword(token, 'SenhaB123'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });
  });

  describe('verificação de e-mail', () => {
    it('confirma o e-mail com o link e não aceita reuso', async () => {
      const user = db.addUser({ email: 'novo@x.com' });
      await service.resendVerification(user.id);
      const token = mailer.lastToken();

      await service.verifyEmail(token);
      expect(user.emailVerifiedAt).toEqual(T0);
      await expect(service.verifyEmail(token)).rejects.toMatchObject({ code: 'LINK_USED' });
    });

    it('link expira em 24 h', async () => {
      const user = db.addUser({ email: 'novo@x.com' });
      await service.resendVerification(user.id);
      advance(24 * 60 + 1);
      await expect(service.verifyEmail(mailer.lastToken())).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
      expect(user.emailVerifiedAt).toBeNull();
    });

    it('cadastro dispara o e-mail de confirmação', async () => {
      await service.register({ name: 'Joana Lima', email: 'joana@x.com', password: 'Senha1234' });
      await new Promise((resolve) => setImmediate(resolve));
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].to).toBe('joana@x.com');
      expect(mailer.sent[0].text).toContain('/verificar-email?token=');
    });

    it('reenvio tem rate limit por usuário (3 por janela) e responde 429', async () => {
      const user = db.addUser({ email: 'novo@x.com' });
      for (let i = 0; i < 3; i++) await service.resendVerification(user.id);
      await expect(service.resendVerification(user.id)).rejects.toMatchObject({ statusCode: 429 });
      expect(mailer.sent).toHaveLength(3);
    });

    it('já verificado: não reenvia', async () => {
      const user = db.addUser({ email: 'ok@x.com', emailVerifiedAt: T0 });
      await expect(service.resendVerification(user.id)).resolves.toEqual({ alreadyVerified: true });
      expect(mailer.sent).toHaveLength(0);
    });
  });
});
