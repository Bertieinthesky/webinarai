-- Video Splitter tables
-- splits: tracks a splitter session (one source video → multiple clips)
-- split_clips: individual clips produced by a split job

CREATE TABLE splits (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                TEXT,
    source_storage_key  TEXT NOT NULL,
    source_filename     TEXT,
    source_size_bytes   BIGINT,
    source_duration_ms  INT,
    source_width        INT,
    source_height       INT,
    markers             JSONB NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'uploaded',
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_splits_user_id ON splits(user_id);

CREATE TABLE split_clips (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    split_id        UUID NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
    clip_index      INT NOT NULL,
    label           TEXT NOT NULL,
    start_ms        INT NOT NULL,
    end_ms          INT NOT NULL,
    storage_key     TEXT,
    size_bytes      BIGINT,
    duration_ms     INT,
    status          TEXT NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_split_clips_split_id ON split_clips(split_id);

-- RLS
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own splits"
    ON splits FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view clips of own splits"
    ON split_clips FOR ALL USING (
        split_id IN (SELECT id FROM splits WHERE user_id = auth.uid())
    );

-- Updated_at trigger (reuse existing function from initial schema)
CREATE TRIGGER set_updated_at_splits
    BEFORE UPDATE ON splits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
