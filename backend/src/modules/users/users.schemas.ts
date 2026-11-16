import { z } from 'zod';

export const BIO_MAX_LENGTH = 280;

/** "" e só espaços viram null (campo opcional apagado) */
const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

/**
 * Aceita telefone formatado — "(48) 99999-8888", "+55 48 99999-8888" — e
 * guarda só os dígitos (com + opcional), formato fácil de usar em WhatsApp/SMS.
 */
const phone = z.preprocess(
  (value) => {
    const v = emptyToNull(value);
    return typeof v === 'string' ? v.replace(/(?!^\+)[^\d]/g, '') : v;
  },
  z
    .string()
    .regex(/^\+?\d{10,13}$/, 'Telefone inválido: use DDD + número (ex.: 48 99999-8888)')
    .nullable(),
);

/**
 * PATCH /users/profile — atualização parcial dos dados do perfil.
 * A CATEGORIA não é editável: ela vem do ranking ELO (strict() recusa "level").
 * A foto NÃO entra aqui: ela só muda pelo endpoint de upload, para que
 * ninguém aponte o avatar para uma URL externa arbitrária.
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string({ message: 'Informe seu nome' })
      .trim()
      .min(2, 'O nome precisa ter pelo menos 2 letras')
      .max(120, 'Nome muito longo'),
    phone,
    bio: z.preprocess(
      emptyToNull,
      z.string().trim().max(BIO_MAX_LENGTH, `A bio pode ter no máximo ${BIO_MAX_LENGTH} caracteres`).nullable(),
    ),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
