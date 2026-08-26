CREATE TABLE inspection_bookings (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  inspection_time TIME NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_bookings_date
  ON inspection_bookings(inspection_date, inspection_time);

CREATE UNIQUE INDEX idx_inspection_bookings_active_slot
  ON inspection_bookings(property_id, inspection_date, inspection_time)
  WHERE status IN ('pending', 'confirmed');