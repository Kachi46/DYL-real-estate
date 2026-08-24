-- Stores only the extracted YouTube video ID (e.g. "dQw4w9WgXcQ"), not a
-- raw URL - this is the canonical form both the watch link
-- (youtube.com/watch?v=<id>) and the thumbnail image
-- (img.youtube.com/vi/<id>/hqdefault.jpg) are built from at render time.
ALTER TABLE properties ADD COLUMN video_id TEXT;

CREATE INDEX idx_properties_video_id
  ON properties (video_id)
  WHERE video_id IS NOT NULL;
