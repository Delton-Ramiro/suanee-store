-- Top 15 scale fixes: index coverage

CREATE INDEX IF NOT EXISTS "orders_paidAt_idx" ON "orders"("paidAt");
CREATE INDEX IF NOT EXISTS "orders_deliveredAt_idx" ON "orders"("deliveredAt");
CREATE INDEX IF NOT EXISTS "orders_returnedAt_idx" ON "orders"("returnedAt");
CREATE INDEX IF NOT EXISTS "orders_cancelledAt_idx" ON "orders"("cancelledAt");
CREATE INDEX IF NOT EXISTS "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "product_categories_categoryId_productId_idx"
	ON "product_categories"("categoryId", "productId");

CREATE INDEX IF NOT EXISTS "product_collections_collectionId_productId_idx"
	ON "product_collections"("collectionId", "productId");

CREATE INDEX IF NOT EXISTS "size_categories_categoryId_sizeId_idx"
	ON "size_categories"("categoryId", "sizeId");

CREATE INDEX IF NOT EXISTS "brand_categories_categoryId_brandId_idx"
	ON "brand_categories"("categoryId", "brandId");

CREATE INDEX IF NOT EXISTS "attribute_definition_categories_categoryId_attributeDefinitionId_idx"
	ON "attribute_definition_categories"("categoryId", "attributeDefinitionId");
