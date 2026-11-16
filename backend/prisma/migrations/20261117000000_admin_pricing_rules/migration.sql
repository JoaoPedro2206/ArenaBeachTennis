-- =============================================================================
-- Painel do dono da arena: regras de preço dinâmico (horário nobre, fim de
-- semana). Bloqueios de manutenção NÃO precisam de tabela nova: usam bookings
-- com type = 'MAINTENANCE', protegidos pela mesma constraint anti-sobreposição.
-- =============================================================================

CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "arena_id" UUID NOT NULL,
    "court_id" UUID,
    "name" VARCHAR(60) NOT NULL,
    "days_of_week" SMALLINT[] NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "price_per_hour" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pricing_rules_price_check" CHECK ("price_per_hour" >= 0),
    -- Ao menos um dia, todos entre 0 (domingo) e 6 (sábado)
    CONSTRAINT "pricing_rules_days_check" CHECK (
      cardinality("days_of_week") > 0 AND "days_of_week" <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
    )
);

CREATE INDEX "pricing_rules_arena_id_idx" ON "pricing_rules"("arena_id");
CREATE INDEX "pricing_rules_court_id_idx" ON "pricing_rules"("court_id");

ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_arena_id_fkey" FOREIGN KEY ("arena_id") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
