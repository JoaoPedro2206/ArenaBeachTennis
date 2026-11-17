import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware ensureAuthenticated */
      user?: {
        id: string;
        role: UserRole;
        emailVerified: boolean;
      };
    }
  }
}

export {};
