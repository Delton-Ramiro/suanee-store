-- CreateTable
CREATE TABLE "collection_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inputType" "InputType" NOT NULL DEFAULT 'multi_select',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_filter_collections" (
    "collectionFilterId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "collection_filter_collections_pkey" PRIMARY KEY ("collectionFilterId","collectionId")
);

-- CreateTable
CREATE TABLE "collection_filter_options" (
    "id" TEXT NOT NULL,
    "collectionFilterId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_filter_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_filters_slug_idx" ON "collection_filters"("slug");

-- CreateIndex
CREATE INDEX "collection_filter_collections_collectionId_collectionFilter_idx" ON "collection_filter_collections"("collectionId", "collectionFilterId");

-- CreateIndex
CREATE UNIQUE INDEX "collection_filter_options_collectionFilterId_value_key" ON "collection_filter_options"("collectionFilterId", "value");

-- AddForeignKey
ALTER TABLE "collection_filter_collections" ADD CONSTRAINT "collection_filter_collections_collectionFilterId_fkey" FOREIGN KEY ("collectionFilterId") REFERENCES "collection_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_filter_collections" ADD CONSTRAINT "collection_filter_collections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_filter_options" ADD CONSTRAINT "collection_filter_options_collectionFilterId_fkey" FOREIGN KEY ("collectionFilterId") REFERENCES "collection_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
