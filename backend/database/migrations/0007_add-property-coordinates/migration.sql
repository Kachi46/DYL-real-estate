ALTER TABLE properties
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION;

ALTER TABLE properties
  ADD CONSTRAINT properties_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT properties_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);