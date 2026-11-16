import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
import { MAX_IMAGE_BYTES } from './uploadImage';
import jwt from 'jsonwebtoken';
import { AppError, NotFoundError } from '../errors/AppError';
import { isProduction } from '../../config/env';

interface ErrorBody {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

/** Códigos do Prisma para "não consegui falar com o banco" (conexão, timeout, pool) */
const DB_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/** Status HTTP anexado por erros do Express/http-errors (ou null) */
function httpStatusOf(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const { status, statusCode } = err as { status?: unknown; statusCode?: unknown };
  const value = typeof status === 'number' ? status : statusCode;
  return typeof value === 'number' ? value : null;
}

/** Converte erros conhecidos (Zod, Prisma, JWT) em AppError. */
function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    const { fieldErrors, formErrors } = err.flatten();
    // formErrors = erros na raiz do objeto (ex.: campo não permitido como "role")
    const details = formErrors.length > 0 ? { ...fieldErrors, _errors: formErrors } : fieldErrors;
    return new AppError('Dados inválidos', 422, 'VALIDATION_ERROR', details);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return new AppError('Registro duplicado', 409, 'CONFLICT', { fields: err.meta?.target });
      case 'P2025':
        return new AppError('Recurso não encontrado', 404, 'NOT_FOUND');
      case 'P2003':
        return new AppError('Referência inválida (chave estrangeira)', 400, 'FOREIGN_KEY_VIOLATION');
      default:
        return new AppError('Erro de banco de dados', 500, 'DATABASE_ERROR');
    }
  }

  if (err instanceof jwt.TokenExpiredError) {
    return new AppError('Token expirado', 401, 'TOKEN_EXPIRED');
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return new AppError('Token inválido', 401, 'INVALID_TOKEN');
  }

  // Banco fora do ar / sem conexão: é 503 ("tente de novo"), não um 500 genérico
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && DB_UNAVAILABLE_CODES.has(err.code))
  ) {
    return new AppError('Serviço temporariamente indisponível. Tente novamente em instantes.', 503, 'SERVICE_UNAVAILABLE');
  }

  // Upload (Multer): arquivo grande demais, campos inesperados etc.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError(`Imagem muito grande. Máximo de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`, 413, 'FILE_TOO_LARGE');
    }
    return new AppError('Upload inválido. Envie uma única imagem no campo "photo".', 400, 'INVALID_UPLOAD');
  }

  // JSON malformado no body (lançado pelo express.json)
  if (err instanceof SyntaxError && 'body' in err) {
    return new AppError('JSON malformado', 400, 'INVALID_JSON');
  }

  // Erros 4xx do próprio Express/body-parser (corpo acima de 1 MB, URL
  // malformada...) carregam o status: sem isto virariam "500 erro interno"
  const status = httpStatusOf(err);
  if (status !== null && status >= 400 && status < 500) {
    return status === 413
      ? new AppError('Requisição grande demais', 413, 'PAYLOAD_TOO_LARGE')
      : new AppError('Requisição inválida', status, 'BAD_REQUEST');
  }

  return new AppError('Erro interno do servidor', 500, 'INTERNAL_ERROR');
}

/** 404 para rotas inexistentes — registrar ANTES do errorHandler. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Rota ${req.method} ${req.originalUrl} não encontrada`));
};

/**
 * Middleware global de erros. O Express 5 já encaminha rejeições de
 * handlers async para cá, sem precisar de try/catch nos controllers.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Resposta já começou a ser enviada: não dá para mandar outro status/JSON.
  // Delega ao Express, que encerra a conexão.
  if (res.headersSent) return next(err);

  const appError = normalizeError(err);

  if (appError.statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  const body: ErrorBody = {
    status: 'error',
    code: appError.code,
    message: appError.message,
  };
  if (appError.details !== undefined) body.details = appError.details;
  if (!isProduction && err instanceof Error) body.stack = err.stack;

  res.status(appError.statusCode).json(body);
};
