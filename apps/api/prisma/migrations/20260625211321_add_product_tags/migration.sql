-- AlterTable
ALTER TABLE "products" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- GIN index for fast array membership queries (tags @> ARRAY['tag'] etc.)
CREATE INDEX IF NOT EXISTS "products_tags_gin_idx" ON "products" USING GIN ("tags");
