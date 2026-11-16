-- Partidas ao vivo: sala com PIN, status WAITING -> IN_PROGRESS -> FINISHED e pontos.
-- As tabelas match_* estavam vazias, então recriar o enum de status é seguro.
-- AlterEnum
BEGIN;
CREATE TYPE "MatchSessionStatus_new" AS ENUM ('WAITING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
ALTER TABLE "public"."match_sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "match_sessions" ALTER COLUMN "status" TYPE "MatchSessionStatus_new" USING ("status"::text::"MatchSessionStatus_new");
ALTER TYPE "MatchSessionStatus" RENAME TO "MatchSessionStatus_old";
ALTER TYPE "MatchSessionStatus_new" RENAME TO "MatchSessionStatus";
DROP TYPE "public"."MatchSessionStatus_old";
ALTER TABLE "match_sessions" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;

-- DropIndex
DROP INDEX "match_sessions_host_id_idx";

-- AlterTable
ALTER TABLE "match_participants" ADD COLUMN     "points_earned" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "amount_due" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "match_sessions" ADD COLUMN     "finished_at" TIMESTAMPTZ(3),
ADD COLUMN     "pin_code" VARCHAR(6),
ADD COLUMN     "points_per_player" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "started_at" TIMESTAMPTZ(3),
ALTER COLUMN "price_per_player" SET DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'WAITING';

-- CreateIndex
CREATE UNIQUE INDEX "match_sessions_pin_code_key" ON "match_sessions"("pin_code");

-- CreateIndex
CREATE INDEX "match_sessions_host_id_status_idx" ON "match_sessions"("host_id", "status");

