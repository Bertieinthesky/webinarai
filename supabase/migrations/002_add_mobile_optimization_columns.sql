-- Add mobile optimization columns to variants table
-- micro_segment_storage_key: R2 key for the 1.5s micro-segment (turbo start)
-- video_720p_storage_key: R2 key for the 720p mobile rendition
-- video_720p_size_bytes: File size of the 720p rendition

ALTER TABLE variants ADD COLUMN IF NOT EXISTS micro_segment_storage_key text;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS video_720p_storage_key text;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS video_720p_size_bytes bigint;
