-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fcmTokens" TEXT[] DEFAULT ARRAY[]::TEXT[];
