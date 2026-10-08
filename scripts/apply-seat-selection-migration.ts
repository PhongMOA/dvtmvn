import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Áp migration prisma/migrations/20261008030000_seat_selection qua connection
 * runtime (DATABASE_URL) — lý do giống scripts/apply-role-migration.ts (schema
 * engine bị treo qua Supavisor pooler).
 *
 * - Event.seatOpenAt / seatTurnMinutes / seatBatchSize: cấu hình mở chọn ghế theo lượt.
 * - SeatAllowance: thứ tự + giờ mở chọn ghế của từng user.
 * - SeatBooking: ghế đã chọn, unique (eventId, seatCode) chống trùng ghế.
 *
 * Idempotent — chạy lại vô hại. Chạy TRƯỚC khi deploy code mới.
 *
 * Chạy:  npx tsx scripts/apply-seat-selection-migration.ts
 */
const prisma = new PrismaClient();

// FK không có "IF NOT EXISTS" -> bọc DO block, bỏ qua khi constraint đã có.
function addForeignKey(table: string, name: string, column: string, refTable: string) {
  return `DO $$ BEGIN
  ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${refTable}"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`;
}

const STATEMENTS = [
  `ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "seatOpenAt" TIMESTAMP(3)`,
  `ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "seatTurnMinutes" INTEGER NOT NULL DEFAULT 15`,
  `ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "seatBatchSize" INTEGER NOT NULL DEFAULT 1`,
  `CREATE TABLE IF NOT EXISTS "SeatAllowance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeatAllowance_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "SeatBooking" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "seatCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeatBooking_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "SeatAllowance_eventId_rank_idx" ON "SeatAllowance"("eventId", "rank")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SeatAllowance_eventId_userId_key" ON "SeatAllowance"("eventId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "SeatBooking_eventId_userId_idx" ON "SeatBooking"("eventId", "userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SeatBooking_eventId_seatCode_key" ON "SeatBooking"("eventId", "seatCode")`,
  addForeignKey("SeatAllowance", "SeatAllowance_eventId_fkey", "eventId", "Event"),
  addForeignKey("SeatAllowance", "SeatAllowance_userId_fkey", "userId", "User"),
  addForeignKey("SeatBooking", "SeatBooking_eventId_fkey", "eventId", "Event"),
  addForeignKey("SeatBooking", "SeatBooking_userId_fkey", "userId", "User"),
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("Xong. Event.seat* + bảng SeatAllowance/SeatBooking đã sẵn sàng.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
