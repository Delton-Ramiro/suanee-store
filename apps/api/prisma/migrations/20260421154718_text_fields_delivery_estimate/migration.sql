-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deliveryEstimate" TEXT,
ALTER COLUMN "keyCharacteristics" SET DATA TYPE TEXT,
ALTER COLUMN "productInfo" SET DATA TYPE TEXT,
ALTER COLUMN "sendPolicy" SET DATA TYPE TEXT,
ALTER COLUMN "returnPolicy" SET DATA TYPE TEXT;
