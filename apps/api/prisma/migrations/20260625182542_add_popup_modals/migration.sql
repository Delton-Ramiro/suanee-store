-- CreateTable
CREATE TABLE "popup_modals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "redirectUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popup_modals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "popup_modals_isActive_idx" ON "popup_modals"("isActive");
