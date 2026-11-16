import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { CategoryBadge } from '@/components/rating/CategoryBadge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  BIO_MAX_LENGTH,
  maskPhone,
  onlyDigits,
  validateProfile,
  type ProfileFormErrors,
  type ProfileFormValues,
} from '@/lib/profileForm';
import { ApiError } from '@/services/api';
import { authService } from '@/services/authService';
import type { UpdateProfileInput, User } from '@/types/auth';
import { PhotoPicker } from './PhotoPicker';

interface EditProfileSheetProps {
  onClose: () => void;
}

type PhotoChange = { kind: 'keep' } | { kind: 'replace'; file: File; previewUrl: string } | { kind: 'remove' };

/**
 * Edição de perfil em tela cheia: foto, nome, telefone, categoria e bio.
 * Envia só o que mudou; a foto vai antes (multipart) e os dados depois.
 */
export function EditProfileSheet({ onClose }: EditProfileSheetProps) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const current = user as User; // a aba Perfil só existe com sessão

  const [values, setValues] = useState<ProfileFormValues>({
    name: current.name,
    phone: maskPhone(current.phone ?? ''),
    bio: current.bio ?? '',
  });
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'keep' });
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Libera a URL temporária do preview quando a foto muda ou o modal fecha
  useEffect(() => {
    if (photo.kind !== 'replace') return;
    return () => URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  const previewUrl =
    photo.kind === 'replace' ? photo.previewUrl : photo.kind === 'remove' ? null : current.profilePhoto;

  /** Só os campos que realmente mudaram */
  const changes = useMemo<UpdateProfileInput>(() => {
    const diff: UpdateProfileInput = {};
    if (values.name.trim() !== current.name) diff.name = values.name.trim();
    const phone = onlyDigits(values.phone);
    if (phone !== (current.phone ?? '')) diff.phone = phone || null;
    const bio = values.bio.trim();
    if (bio !== (current.bio ?? '')) diff.bio = bio || null;
    return diff;
  }, [values, current]);

  const isDirty = Object.keys(changes).length > 0 || photo.kind !== 'keep';

  function update<K extends keyof ProfileFormValues>(field: K, value: string) {
    setValues((v) => ({ ...v, [field]: field === 'phone' ? maskPhone(value) : value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined })); // limpa o erro ao corrigir
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    const found = validateProfile(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = Object.keys(found)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] textarea`)?.focus();
      return;
    }
    if (!isDirty) return onClose();

    setIsSubmitting(true);
    let latest: User = current;
    try {
      if (photo.kind === 'replace') latest = await authService.uploadPhoto(photo.file);
      if (photo.kind === 'remove') latest = await authService.removePhoto();
      if (Object.keys(changes).length > 0) latest = await authService.updateProfile(changes);

      setUser(latest);
      toast.success('Perfil atualizado com sucesso');
      onClose();
    } catch (err) {
      setUser(latest); // se a foto subiu e os dados falharam, a tela reflete a foto nova
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.details) {
        setErrors({
          name: err.fieldError('name'),
          phone: err.fieldError('phone'),
          bio: err.fieldError('bio'),
        });
        toast.error('Revise os campos destacados.');
      } else if (err instanceof ApiError && ['FILE_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE'].includes(err.code)) {
        setErrors({ photo: err.message });
        toast.error(err.message);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar. Tente novamente.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open
      fullScreen
      onClose={onClose}
      dismissible={!isSubmitting}
      title="Editar perfil"
      description="Como os outros jogadores veem você"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} fullWidth={false} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" form="edit-profile-form" loading={isSubmitting} disabled={!isDirty} className="flex-[2]">
            {isSubmitting ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      }
    >
      <form id="edit-profile-form" onSubmit={handleSubmit} noValidate className="mx-auto max-w-md space-y-8">
        <PhotoPicker
          name={values.name}
          previewUrl={previewUrl}
          disabled={isSubmitting}
          error={errors.photo}
          onPick={(file) => {
            setErrors((e) => ({ ...e, photo: undefined }));
            setPhoto({ kind: 'replace', file, previewUrl: URL.createObjectURL(file) });
          }}
          onRemove={() => setPhoto(current.profilePhoto ? { kind: 'remove' } : { kind: 'keep' })}
          onInvalid={(message) => {
            setErrors((e) => ({ ...e, photo: message }));
            toast.error(message);
          }}
        />

        <fieldset disabled={isSubmitting} className="space-y-6 rounded-lg bg-surface p-5 shadow-sm">
          <legend className="sr-only">Dados pessoais</legend>
          <div data-field="name">
            <TextField
              label="Nome"
              autoComplete="name"
              required
              maxLength={120}
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              error={errors.name}
            />
          </div>
          <div data-field="phone">
            <TextField
              label="Telefone (WhatsApp)"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(48) 99999-8888"
              value={values.phone}
              onChange={(e) => update('phone', e.target.value)}
              error={errors.phone}
              hint="Opcional · ajuda parceiros a combinar o jogo"
            />
          </div>
        </fieldset>

        <fieldset disabled={isSubmitting} className="space-y-6 rounded-lg bg-surface p-5 shadow-sm">
          <legend className="sr-only">Perfil de jogo</legend>
          {/* Categoria: só leitura — vem do ranking ELO, não é escolhida */}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Categoria</p>
            <div className="flex items-center gap-3 rounded-md bg-surface-muted px-4 py-3">
              <CategoryBadge level={current.level} size="sm" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">
                  {current.rank.name} · <span className="tabular-nums">{current.eloScore} pts</span>
                </p>
                <p className="text-xs text-ink-subtle">Calculada pelos seus resultados nas partidas ao vivo</p>
              </div>
            </div>
          </div>
          <div data-field="bio">
            <TextAreaField
              label="Bio"
              placeholder="Ex.: Jogo de manhã, lado esquerdo, procuro dupla para torneios."
              maxChars={BIO_MAX_LENGTH}
              value={values.bio}
              onChange={(e) => update('bio', e.target.value)}
              error={errors.bio}
            />
          </div>
        </fieldset>

        <p className="text-center text-xs text-ink-subtle">E-mail: {current.email} · não pode ser alterado aqui</p>
      </form>
    </Modal>
  );
}
