-- Regras de integridade de reservas que o Prisma não expressa no schema.
-- Esta é a garantia final contra reservas duplicadas: mesmo que duas
-- requisições passem pela checagem do service ao mesmo tempo, o banco
-- rejeita a segunda (erro 23P01).

-- Necessária para combinar "=" (court_id) e "&&" (intervalo) no mesmo índice GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Fim sempre depois do início
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_time_range_check" CHECK ("end_time" > "start_time");

-- Duas reservas não canceladas da mesma quadra não podem se sobrepor.
-- Intervalo "[)" = fechado no início e aberto no fim: 18:00-19:00 e
-- 19:00-20:00 NÃO conflitam.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "court_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELLED');
