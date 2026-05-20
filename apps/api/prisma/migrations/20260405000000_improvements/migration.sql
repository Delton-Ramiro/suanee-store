-- ─── SizeGuide: rename notes → description ───────────────────────────────────
ALTER TABLE "size_guides" RENAME COLUMN "notes" TO "description";

-- ─── Product: add genderScope ─────────────────────────────────────────────────
ALTER TABLE "products" ADD COLUMN "genderScope" "GenderScope";

-- ─── ProductMedia: add isDeleted ─────────────────────────────────────────────
ALTER TABLE "product_media" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- ─── AttributeDefinition: migrate to multi-category ─────────────────────────

-- 1. Create the join table
CREATE TABLE "attribute_definition_categories" (
    "attributeDefinitionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "attribute_definition_categories_pkey" PRIMARY KEY ("attributeDefinitionId","categoryId")
);

-- 2. Migrate existing single-category associations into the join table
INSERT INTO "attribute_definition_categories" ("attributeDefinitionId", "categoryId")
SELECT "id", "categoryId" FROM "attribute_definitions";

-- 3. Drop old constraints and column
DROP INDEX IF EXISTS "attribute_definitions_categoryId_idx";
DROP INDEX IF EXISTS "attribute_definitions_categoryId_slug_key";
ALTER TABLE "attribute_definitions" DROP CONSTRAINT IF EXISTS "attribute_definitions_categoryId_fkey";
ALTER TABLE "attribute_definitions" DROP COLUMN "categoryId";

-- 4. Add index on slug for query performance (not globally unique)
CREATE INDEX "attribute_definitions_slug_idx" ON "attribute_definitions"("slug");

-- 5. Add FK constraints for join table
ALTER TABLE "attribute_definition_categories"
    ADD CONSTRAINT "attribute_definition_categories_attributeDefinitionId_fkey"
    FOREIGN KEY ("attributeDefinitionId") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attribute_definition_categories"
    ADD CONSTRAINT "attribute_definition_categories_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AdminPasswordResetRequest: new table ────────────────────────────────────
CREATE TABLE "admin_password_reset_requests" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "newPwdHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_password_reset_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admin_password_reset_requests"
    ADD CONSTRAINT "admin_password_reset_requests_tokenHash_key" UNIQUE ("tokenHash");

ALTER TABLE "admin_password_reset_requests"
    ADD CONSTRAINT "admin_password_reset_requests_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
