-- Write your migration SQL here
--
-- Example:
--   CREATE TABLE IF NOT EXISTS users (
--     id SERIAL PRIMARY KEY,
--     name TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT NOW()
--   );

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  phone TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT NOT NULL
    CHECK (property_type IN ('land', 'residential', 'commercial')),
  listing_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (listing_type IN ('sale', 'rent')),
  price DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  size_sqm DOUBLE PRECISION,
  bedrooms INTEGER,
  bathrooms INTEGER,
  images TEXT NOT NULL DEFAULT '[]',
  title_document TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verification_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'removed')),
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE inquiries (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE saved_properties (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  published INTEGER NOT NULL DEFAULT 0
    CHECK (published IN (0, 1)),
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP
);

CREATE INDEX idx_properties_state
  ON properties(state);

CREATE INDEX idx_properties_type
  ON properties(property_type);

CREATE INDEX idx_properties_verification
  ON properties(verification_status);

CREATE INDEX idx_posts_published
  ON posts(published, published_at);
