-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "seatBatchSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seatOpenAt" TIMESTAMP(3),
ADD COLUMN     "seatTurnMinutes" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "SeatAllowance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatBooking" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "seatCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeatAllowance_eventId_rank_idx" ON "SeatAllowance"("eventId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllowance_eventId_userId_key" ON "SeatAllowance"("eventId", "userId");

-- CreateIndex
CREATE INDEX "SeatBooking_eventId_userId_idx" ON "SeatBooking"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatBooking_eventId_seatCode_key" ON "SeatBooking"("eventId", "seatCode");

-- AddForeignKey
ALTER TABLE "SeatAllowance" ADD CONSTRAINT "SeatAllowance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllowance" ADD CONSTRAINT "SeatAllowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatBooking" ADD CONSTRAINT "SeatBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatBooking" ADD CONSTRAINT "SeatBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

