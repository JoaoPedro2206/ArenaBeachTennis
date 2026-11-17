import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .max(180);

/** Regras de senha — iguais no cadastro e na redefinição */
export const passwordSchema = z
  .string()
  // bcrypt só considera os primeiros 72 bytes, por isso o limite
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
  .regex(/\d/, 'A senha deve conter ao menos um número');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome muito curto').max(120),
    email,
    password: passwordSchema,
    phone: z
      .string()
      .trim()
      .regex(/^\+?\d{10,15}$/, 'Telefone deve conter de 10 a 15 dígitos')
      .optional(),
  })
  .strict(); // rejeita campos extras como "role", "level" ou "eloScore"

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha').max(72),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().trim().min(20).max(200) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
