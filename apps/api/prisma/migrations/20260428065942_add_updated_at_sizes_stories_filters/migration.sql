/*
  Warnings:

  - Added the required column `updatedAt` to the `attribute_definitions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `sizes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `stories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attribute_definitions" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "attribute_definitions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sizes" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "sizes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stories" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "stories" ALTER COLUMN "updatedAt" DROP DEFAULT;
