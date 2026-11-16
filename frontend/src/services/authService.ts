import { api } from './api';
import type { AuthResponse, LoginInput, RegisterInput, UpdateProfileInput, User } from '@/types/auth';

/** Endpoints de autenticação e do próprio usuário */
export const authService = {
  login: (data: LoginInput) => api<AuthResponse>('/auth/login', { method: 'POST', body: data }),

  register: (data: RegisterInput) => api<AuthResponse>('/auth/register', { method: 'POST', body: data }),

  me: (signal?: AbortSignal) => api<{ user: User }>('/users/me', { signal }).then((r) => r.user),

  /** PATCH /users/profile — envia só os campos alterados */
  updateProfile: (data: UpdateProfileInput) =>
    api<{ user: User }>('/users/profile', { method: 'PATCH', body: data }).then((r) => r.user),

  /** multipart/form-data, campo "photo" (o axios define o boundary sozinho) */
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return api<{ user: User }>('/users/profile/photo', { method: 'POST', body: form }).then((r) => r.user);
  },

  removePhoto: () => api<{ user: User }>('/users/profile/photo', { method: 'DELETE' }).then((r) => r.user),
};
