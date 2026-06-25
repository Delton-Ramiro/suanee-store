-- CreateTable
CREATE TABLE "product_collection_filter_attributes" (
    "productId" TEXT NOT NULL,
    "collectionFilterId" TEXT NOT NULL,
    "collectionFilterOptionId" TEXT NOT NULL,

    CONSTRAINT "product_collection_filter_attributes_pkey" PRIMARY KEY ("productId","collectionFilterId","collectionFilterOptionId")
);

-- CreateIndex
CREATE INDEX "product_collection_filter_attributes_productId_idx" ON "product_collection_filter_attributes"("productId");

-- AddForeignKey
ALTER TABLE "product_collection_filter_attributes" ADD CONSTRAINT "product_collection_filter_attributes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_collection_filter_attributes" ADD CONSTRAINT "product_collection_filter_attributes_collectionFilterId_fkey" FOREIGN KEY ("collectionFilterId") REFERENCES "collection_filters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_collection_filter_attributes" ADD CONSTRAINT "product_collection_filter_attributes_collectionFilterOptio_fkey" FOREIGN KEY ("collectionFilterOptionId") REFERENCES "collection_filter_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
