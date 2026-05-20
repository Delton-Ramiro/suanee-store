-- Enable pg_trgm extension for trigram-based fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on product name (supports ILIKE '%term%' queries)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

-- GIN trigram index on user name + email for admin person search
CREATE INDEX IF NOT EXISTS idx_users_search_trgm
  ON users USING GIN ((name || ' ' || email) gin_trgm_ops);
