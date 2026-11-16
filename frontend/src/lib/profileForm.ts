/**
 * Regras do formulário de perfil (espelham o backend em users.schemas.ts).
 * Funções puras: fáceis de testar e sem dependência de React.
 */
export const BIO_MAX_LENGTH = 280;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ProfileFormValues {
  name: string;
  phone: string; // com máscara, ex.: "(48) 99999-8888"
  bio: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues | 'photo', string>>;

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

/** Máscara brasileira progressiva: "4899" -> "(48) 99", "48999998888" -> "(48) 99999-8888" */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; // fixo
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; // celular
}

export function validateProfile(values: ProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const name = values.name.trim();

  if (name.length === 0) errors.name = 'Informe seu nome';
  else if (name.length < 2) errors.name = 'O nome precisa ter pelo menos 2 letras';
  else if (name.length > 120) errors.name = 'Nome muito longo';

  const phoneDigits = onlyDigits(values.phone);
  if (phoneDigits.length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
    errors.phone = 'Telefone incompleto: use DDD + número';
  }

  if (values.bio.trim().length > BIO_MAX_LENGTH) errors.bio = `Máximo de ${BIO_MAX_LENGTH} caracteres`;

  return errors;
}

/** Mensagem de erro para uma foto escolhida (ou null se estiver ok) */
export function validatePhoto(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) return 'Use uma imagem JPG, PNG ou WebP.';
  if (file.size > MAX_PHOTO_BYTES) return 'A imagem deve ter no máximo 5 MB.';
  return null;
}
