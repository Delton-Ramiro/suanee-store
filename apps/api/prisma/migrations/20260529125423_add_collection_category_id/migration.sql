-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "collections_categoryId_idx" ON "collections"("categoryId");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
