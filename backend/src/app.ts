import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env';
import { routes } from './routes';
import { errorHandler, notFoundHandler } from './shared/middlewares/errorHandler';
import { UPLOADS_DIR, UPLOADS_PUBLIC_PATH } from './shared/providers/storage';

/**
 * Fábrica da aplicação Express (separada do server.ts para facilitar
 * testes de integração com supertest, sem abrir porta).
 */
export function createApp(): Express {
  const app = express();

  // Segurança e parsing
  app.disable('x-powered-by');
  // IP real do cliente atrás de proxy (usado pelo rate limit de login/PIN)
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  // Arquivos enviados (dev). Em produção as URLs apontam direto para S3/CDN.
  app.use(
    UPLOADS_PUBLIC_PATH,
    express.static(UPLOADS_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' }),
  );

  // Rotas versionadas
  app.use('/api/v1', routes);

  // Tratamento de erros (sempre por último)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
