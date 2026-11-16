-- Novos cadastros começam como Iniciante.
-- (O campo avatarUrl -> profilePhoto foi só renomeado no Prisma: a coluna
-- continua "avatar_url", então nenhum dado é migrado.)
ALTER TABLE "users" ALTER COLUMN "level" SET DEFAULT 'INICIANTE';
