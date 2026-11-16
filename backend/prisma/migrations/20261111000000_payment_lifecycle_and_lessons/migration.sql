-- =============================================================================
-- Fase: ciclo de pagamento (PENDING_PAYMENT + prazo de 15 min) e módulo de aulas
-- =============================================================================

-- Renomeia o status em vez de recriar o enum (o Prisma geraria DROP/CREATE do
-- tipo, o que quebraria a EXCLUSION CONSTRAINT "bookings_no_overlap", cujo
-- WHERE depende da coluna status). RENAME VALUE preserva os dados existentes.
ALTER TYPE "BookingStatus" RENAME VALUE 'PENDING' TO 'PENDING_PAYMENT';
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- Prazo de pagamento
ALTER TABLE "bookings" ADD COLUMN "expires_at" TIMESTAMPTZ(3),
ADD COLUMN "paid_at" TIMESTAMPTZ(3);

-- Reservas pendentes que já existiam ganham o mesmo prazo de 15 min a partir da
-- criação; a rotina de expiração cancela as que já passaram do prazo.
UPDATE "bookings"
SET "expires_at" = "created_at" + INTERVAL '15 minutes'
WHERE "status" = 'PENDING_PAYMENT' AND "expires_at" IS NULL;

-- CreateEnum
CREATE TYPE "LessonLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "arena_id" UUID NOT NULL,
    "bio" VARCHAR(600),
    "levels" "LessonLevel"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "series_id" UUID,
    "title" VARCHAR(120) NOT NULL,
    "level" "LessonLevel" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price_per_student" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_enrollments" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teachers_user_id_key" ON "teachers"("user_id");

-- CreateIndex
CREATE INDEX "teachers_arena_id_is_active_idx" ON "teachers"("arena_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_booking_id_key" ON "lessons"("booking_id");

-- CreateIndex
CREATE INDEX "lessons_teacher_id_idx" ON "lessons"("teacher_id");

-- CreateIndex
CREATE INDEX "lessons_series_id_idx" ON "lessons"("series_id");

-- CreateIndex
CREATE INDEX "lesson_enrollments_user_id_status_idx" ON "lesson_enrollments"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_enrollments_lesson_id_user_id_key" ON "lesson_enrollments"("lesson_id", "user_id");

-- CreateIndex
CREATE INDEX "bookings_status_expires_at_idx" ON "bookings"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_arena_id_fkey" FOREIGN KEY ("arena_id") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_enrollments" ADD CONSTRAINT "lesson_enrollments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_enrollments" ADD CONSTRAINT "lesson_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

