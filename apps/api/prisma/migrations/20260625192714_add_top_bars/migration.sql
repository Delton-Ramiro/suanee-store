-- CreateTable
CREATE TABLE "top_bars" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "timerSeconds" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_bars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "top_bars_isActive_idx" ON "top_bars"("isActive");
