-- CreateTable
CREATE TABLE "product_related" (
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "product_related_pkey" PRIMARY KEY ("sourceId","targetId")
);

-- CreateIndex
CREATE INDEX "product_related_sourceId_idx" ON "product_related"("sourceId");

-- AddForeignKey
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
