-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'TEACHER', 'ARENA_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "PlayerLevel" AS ENUM ('D', 'C', 'B', 'A');

-- CreateEnum
CREATE TYPE "CourtSurface" AS ENUM ('SAND', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('REGULAR', 'OPEN_MATCH', 'CLASS', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MatchSessionStatus" AS ENUM ('OPEN', 'FULL', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('SINGLES', 'DOUBLES');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'LEFT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" TEXT,
    "bio" VARCHAR(500),
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "level" "PlayerLevel" NOT NULL DEFAULT 'D',
    "ranking_points" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arenas" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(1000),
    "phone" VARCHAR(20),
    "address" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" CHAR(2) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "arenas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL,
    "arena_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "surface" "CourtSurface" NOT NULL DEFAULT 'SAND',
    "is_covered" BOOLEAN NOT NULL DEFAULT false,
    "has_lighting" BOOLEAN NOT NULL DEFAULT true,
    "status" "CourtStatus" NOT NULL DEFAULT 'ACTIVE',
    "price_per_hour" INTEGER NOT NULL,
    "slot_duration_min" INTEGER NOT NULL DEFAULT 60,
    "open_time" VARCHAR(5) NOT NULL DEFAULT '06:00',
    "close_time" VARCHAR(5) NOT NULL DEFAULT '23:00',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(3) NOT NULL,
    "end_time" TIMESTAMPTZ(3) NOT NULL,
    "type" "BookingType" NOT NULL DEFAULT 'REGULAR',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "total_price" INTEGER NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_external_id" TEXT,
    "notes" VARCHAR(500),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(255),
    "rescheduled_from_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_sessions" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "title" VARCHAR(120),
    "description" VARCHAR(500),
    "format" "MatchFormat" NOT NULL DEFAULT 'DOUBLES',
    "max_players" INTEGER NOT NULL DEFAULT 4,
    "min_level" "PlayerLevel",
    "max_level" "PlayerLevel",
    "price_per_player" INTEGER NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "status" "MatchSessionStatus" NOT NULL DEFAULT 'OPEN',
    "score" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "match_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" UUID NOT NULL,
    "match_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "team" SMALLINT,
    "amount_due" INTEGER NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_external_id" TEXT,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "match_session_id" UUID,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "url" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "caption" VARCHAR(300),
    "size_bytes" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_level_idx" ON "users"("level");

-- CreateIndex
CREATE UNIQUE INDEX "arenas_slug_key" ON "arenas"("slug");

-- CreateIndex
CREATE INDEX "arenas_owner_id_idx" ON "arenas"("owner_id");

-- CreateIndex
CREATE INDEX "arenas_city_state_idx" ON "arenas"("city", "state");

-- CreateIndex
CREATE INDEX "courts_arena_id_status_idx" ON "courts"("arena_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "courts_arena_id_name_key" ON "courts"("arena_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_rescheduled_from_id_key" ON "bookings"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "bookings_court_id_start_time_end_time_idx" ON "bookings"("court_id", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "bookings_user_id_start_time_idx" ON "bookings"("user_id", "start_time");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_sessions_booking_id_key" ON "match_sessions"("booking_id");

-- CreateIndex
CREATE INDEX "match_sessions_status_is_public_idx" ON "match_sessions"("status", "is_public");

-- CreateIndex
CREATE INDEX "match_sessions_host_id_idx" ON "match_sessions"("host_id");

-- CreateIndex
CREATE INDEX "match_participants_user_id_idx" ON "match_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_match_session_id_user_id_key" ON "match_participants"("match_session_id", "user_id");

-- CreateIndex
CREATE INDEX "media_uploader_id_created_at_idx" ON "media"("uploader_id", "created_at");

-- CreateIndex
CREATE INDEX "media_match_session_id_idx" ON "media"("match_session_id");

-- AddForeignKey
ALTER TABLE "arenas" ADD CONSTRAINT "arenas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_arena_id_fkey" FOREIGN KEY ("arena_id") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_sessions" ADD CONSTRAINT "match_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_sessions" ADD CONSTRAINT "match_sessions_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_session_id_fkey" FOREIGN KEY ("match_session_id") REFERENCES "match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_match_session_id_fkey" FOREIGN KEY ("match_session_id") REFERENCES "match_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
