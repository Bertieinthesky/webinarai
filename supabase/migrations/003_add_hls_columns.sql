-- HLS adaptive bitrate streaming columns on variants
ALTER TABLE variants ADD COLUMN IF NOT EXISTS hls_master_manifest_key text;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS hls_status text;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS hls_error_message text;
