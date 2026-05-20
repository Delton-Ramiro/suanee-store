-- DropIndex
DROP INDEX "idx_products_name_trgm";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "bruteMargin" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "bruteMargin" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "product_suppliers" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "product_suppliers_productId_isDefault_idx" ON "product_suppliers"("productId", "isDefault");

-- RenameIndex
ALTER INDEX "attribute_definition_categories_categoryId_attributeDefinitionI" RENAME TO "attribute_definition_categories_categoryId_attributeDefinit_idx";
