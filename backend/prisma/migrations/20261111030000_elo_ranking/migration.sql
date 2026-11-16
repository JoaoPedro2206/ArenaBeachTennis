-- =============================================================================
-- Ranking ELO: a categoria deixa de ser escolhida pelo jogador e passa a ser
-- derivada do elo_score. Ordem importa: cria e PREENCHE o ELO a partir da
-- categoria atual ANTES de remover a coluna "level" (ninguém é rebaixado).
-- =============================================================================

-- 1) Nova pontuação
ALTER TABLE "users" ADD COLUMN "elo_score" INTEGER NOT NULL DEFAULT 1000;

-- 2) Cada jogador começa no PISO da categoria que já tinha
--    (faixas definidas em src/modules/rating/categories.ts)
UPDATE "users" SET "elo_score" = CASE "level"
  WHEN 'D' THEN 1200
  WHEN 'C' THEN 1500
  WHEN 'B' THEN 2000
  WHEN 'A' THEN 2400
  ELSE 1000
END;

-- 3) Remove a categoria estática e os pontos por participação (substituídos pelo ELO)
DROP INDEX "users_level_idx";
ALTER TABLE "users" DROP COLUMN "level", DROP COLUMN "ranking_points";
CREATE INDEX "users_elo_score_idx" ON "users"("elo_score");

ALTER TABLE "match_sessions" DROP COLUMN "points_per_player";

-- 4) Histórico de ELO por jogador em cada partida (null = partida não pontuada).
--    Os antigos "+10 por participação" não são ELO, então não são migrados.
ALTER TABLE "match_participants" DROP COLUMN "points_earned",
ADD COLUMN "elo_before" INTEGER,
ADD COLUMN "elo_after" INTEGER,
ADD COLUMN "elo_delta" INTEGER;

-- 5) Resultado das partidas pontuadas
CREATE TABLE "match_results" (
    "id" UUID NOT NULL,
    "match_session_id" UUID NOT NULL,
    "winner_team" SMALLINT NOT NULL,
    "loser_team" SMALLINT NOT NULL,
    "team1_avg_elo" INTEGER NOT NULL,
    "team2_avg_elo" INTEGER NOT NULL,
    "winner_delta" INTEGER NOT NULL,
    "loser_delta" INTEGER NOT NULL,
    "winner_expected" DOUBLE PRECISION NOT NULL,
    "k_factor" INTEGER NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "match_results_teams_check" CHECK ("winner_team" IN (1, 2) AND "loser_team" IN (1, 2) AND "winner_team" <> "loser_team")
);
CREATE UNIQUE INDEX "match_results_match_session_id_key" ON "match_results"("match_session_id");
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_session_id_fkey" FOREIGN KEY ("match_session_id") REFERENCES "match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
