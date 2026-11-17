import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/ensureAuthenticated';
import { AuthService } from './auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas';

/** Mesma resposta para e-mail existente ou não (não revela quem é cadastrado) */
export const FORGOT_PASSWORD_MESSAGE =
  'Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha em instantes.';

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const data = registerSchema.parse(req.body);
    const result = await this.authService.register(data);
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const data = loginSchema.parse(req.body);
    const result = await this.authService.login(data);
    res.json(result);
  };

  /**
   * POST /auth/forgot-password — responde 202 ANTES de consultar o banco ou
   * enviar o e-mail, então tempo e corpo da resposta são idênticos
   * para e-mails cadastrados e não cadastrados.
   */
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = forgotPasswordSchema.parse(req.body);
    res.status(202).json({ message: FORGOT_PASSWORD_MESSAGE });

    this.authService.requestPasswordReset(email).catch((error) => {
      console.error('Falha no fluxo de recuperação de senha:', error);
    });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await this.authService.resetPassword(token, password);
    res.json({ message: 'Senha redefinida. Entre com a nova senha.' });
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const { token } = verifyEmailSchema.parse(req.body);
    await this.authService.verifyEmail(token);
    res.json({ message: 'E-mail confirmado com sucesso.' });
  };

  resendVerification = async (req: Request, res: Response): Promise<void> => {
    const { alreadyVerified } = await this.authService.resendVerification(getAuthUser(req).id);
    res.status(202).json({
      message: alreadyVerified ? 'Seu e-mail já está confirmado.' : 'Enviamos um novo link de confirmação.',
      alreadyVerified,
    });
  };
}
