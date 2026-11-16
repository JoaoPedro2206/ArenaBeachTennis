-- Nova categoria abaixo do D (Iniciante -> D -> C -> B -> A).
-- Fica numa migration própria: o PostgreSQL não permite USAR um valor de enum
-- na mesma transação em que ele foi criado (o DEFAULT está na próxima).
ALTER TYPE "PlayerLevel" ADD VALUE IF NOT EXISTS 'INICIANTE' BEFORE 'D';
