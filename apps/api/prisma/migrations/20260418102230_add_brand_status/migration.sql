-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('draft', 'published');

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "status" "BrandStatus" NOT NULL DEFAULT 'published';
