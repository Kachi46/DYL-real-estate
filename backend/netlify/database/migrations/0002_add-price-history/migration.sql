-- Tracks every price a property has ever been listed at, so gainers/losers
-- can be computed from real recorded changes instead of hardcoded numbers.
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  price DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_property_id ON price_history (property_id);
CREATE INDEX idx_price_history_recorded_at ON price_history (recorded_at);

-- Backfill: give every existing property a baseline history point at its
-- current price, dated to when it was created. Without this, properties
-- that existed before this migration would have no history at all until
-- their price is next edited.
INSERT INTO price_history (property_id, price, recorded_at)
SELECT id, price, created_at
FROM properties;
