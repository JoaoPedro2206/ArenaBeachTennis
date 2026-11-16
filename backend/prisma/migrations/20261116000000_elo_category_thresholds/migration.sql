-- =============================================================================
-- Novas faixas de categoria (src/modules/rating/categories.ts):
--   antes:  D 1200–1499 | C 1500–1999 | B 2000–2399 | A 2400+
--   agora:  D 1200–1399 | C 1400–1599 | B 1600–1799 | A 1800+
-- Reescala o ELO de cada jogador DENTRO da sua faixa, para que ninguém mude de
-- categoria só por causa da troca de regra (e quem estava no meio da faixa
-- continua no meio). Iniciante (<1200) não muda.
-- =============================================================================

UPDATE "users" SET "elo_score" = CASE
  WHEN "elo_score" >= 2400 THEN 1800 + ("elo_score" - 2400)
  -- FLOOR (não ROUND): o topo da faixa antiga (ex.: 1999) tem que cair no topo
  -- da nova (1599), e não arredondar para a categoria de cima (1600)
  WHEN "elo_score" >= 2000 THEN 1600 + FLOOR(("elo_score" - 2000) * 200.0 / 400)::int
  WHEN "elo_score" >= 1500 THEN 1400 + FLOOR(("elo_score" - 1500) * 200.0 / 500)::int
  WHEN "elo_score" >= 1200 THEN 1200 + FLOOR(("elo_score" - 1200) * 200.0 / 300)::int
  ELSE "elo_score"
END
WHERE "elo_score" >= 1200;
