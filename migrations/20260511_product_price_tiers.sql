-- Tiered selling prices for product_prices (salesman / branch overrides).
-- Factory/minimum price remains on products.factory_price (or cost).
-- Safe to run multiple times.

BEGIN;

ALTER TABLE product_prices
  ADD COLUMN IF NOT EXISTS price_high NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_medium NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_low NUMERIC(10, 2);

COMMENT ON COLUMN product_prices.price_high IS 'Highest allowed selling tier for this override row';
COMMENT ON COLUMN product_prices.price_medium IS 'Normal selling tier (stored in legacy price when tiers used)';
COMMENT ON COLUMN product_prices.price_low IS 'Lowest selling tier above factory';

COMMIT;
