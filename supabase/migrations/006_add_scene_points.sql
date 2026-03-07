-- Migration 006: Add scene detection results to splits
-- Stores detected scene changes and silence gaps as JSONB array
-- Format: [{timeMs, confidence, type: "scene_change"|"silence"}, ...]

ALTER TABLE splits ADD COLUMN IF NOT EXISTS scene_points JSONB DEFAULT NULL;
