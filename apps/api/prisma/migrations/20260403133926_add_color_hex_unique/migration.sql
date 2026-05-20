/*
  Warnings:

  - A unique constraint covering the columns `[hexCode]` on the table `colors` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "colors_hexCode_key" ON "colors"("hexCode");
