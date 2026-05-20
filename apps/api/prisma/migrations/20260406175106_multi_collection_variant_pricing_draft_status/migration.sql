/*
  Warnings:

  - You are about to drop the column `priceOverride` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `collectionId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `products` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'published', 'archived');

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_collectionId_fkey";

-- DropIndex
DROP INDEX "products_collectionId_idx";

-- DropIndex
DROP INDEX "products_isPublished_isVisible_idx";

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "priceOverride",
ADD COLUMN     "discountPrice" DECIMAL(10,2),
ADD COLUMN     "hasDiscount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isIndicativePrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" DROP COLUMN "collectionId",
DROP COLUMN "isPublished",
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "product_collections" (
    "productId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "product_collections_pkey" PRIMARY KEY ("productId","collectionId")
);

-- CreateIndex
CREATE INDEX "products_status_isVisible_idx" ON "products"("status", "isVisible");

-- AddForeignKey
ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
