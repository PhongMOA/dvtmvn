-- CreateTable
CREATE TABLE "LuckyDraw" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LuckyDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LuckyDrawWinner" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "seatCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "maskedPhone" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "drawnBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LuckyDrawWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LuckyDraw_eventId_key" ON "LuckyDraw"("eventId");

-- CreateIndex
CREATE INDEX "LuckyDrawWinner_drawId_round_idx" ON "LuckyDrawWinner"("drawId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "LuckyDrawWinner_drawId_seatCode_key" ON "LuckyDrawWinner"("drawId", "seatCode");

-- Mỗi round tối đa 1 lượt còn hiệu lực (Prisma không khai báo được partial index).
CREATE UNIQUE INDEX "LuckyDrawWinner_drawId_round_active_key" ON "LuckyDrawWinner"("drawId", "round") WHERE "voided" = false;

-- AddForeignKey
ALTER TABLE "LuckyDraw" ADD CONSTRAINT "LuckyDraw_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LuckyDrawWinner" ADD CONSTRAINT "LuckyDrawWinner_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "LuckyDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;
