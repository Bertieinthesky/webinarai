-- =============================================================
-- webinar.ai Database Schema — Phase 1
-- Supabase PostgreSQL with Row Level Security
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE segment_type AS ENUM ('hook', 'body', 'cta');
CREATE TYPE segment_status AS ENUM ('uploading', 'uploaded', 'normalizing', 'normalized', 'failed');
CREATE TYPE variant_status AS ENUM ('pending', 'rendering', 'rendered', 'failed');
CREATE TYPE project_status AS ENUM ('draft', 'processing', 'ready', 'archived');

-- Projects
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    status          project_status NOT NULL DEFAULT 'draft',
    target_width        INT NOT NULL DEFAULT 1920,
    target_height       INT NOT NULL DEFAULT 1080,
    target_fps          INT NOT NULL DEFAULT 30,
    target_video_codec  TEXT NOT NULL DEFAULT 'libx264',
    target_audio_codec  TEXT NOT NULL DEFAULT 'aac',
    target_audio_rate   INT NOT NULL DEFAULT 44100,
    target_pixel_format TEXT NOT NULL DEFAULT 'yuv420p',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_slug ON projects(slug);

-- Segments
CREATE TABLE segments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type                segment_type NOT NULL,
    label               TEXT NOT NULL,
    sort_order          INT NOT NULL DEFAULT 0,
    original_storage_key    TEXT,
    original_filename       TEXT,
    original_size_bytes     BIGINT,
    original_duration_ms    INT,
    original_width          INT,
    original_height         INT,
    original_fps            NUMERIC(6,2),
    original_codec          TEXT,
    normalized_storage_key  TEXT,
    normalized_size_bytes   BIGINT,
    normalized_duration_ms  INT,
    status              segment_status NOT NULL DEFAULT 'uploading',
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_project_id ON segments(project_id);
CREATE INDEX idx_segments_project_type ON segments(project_id, type);

-- Variants
CREATE TABLE variants (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    hook_segment_id     UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    body_segment_id     UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    cta_segment_id      UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    video_storage_key   TEXT,
    video_size_bytes    BIGINT,
    video_duration_ms   INT,
    hook_clip_storage_key   TEXT,
    hook_clip_size_bytes    BIGINT,
    hook_clip_duration_ms   INT,
    hook_end_time_ms    INT,
    status              variant_status NOT NULL DEFAULT 'pending',
    error_message       TEXT,
    variant_code        TEXT NOT NULL,
    weight              NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, hook_segment_id, body_segment_id, cta_segment_id)
);

CREATE INDEX idx_variants_project_id ON variants(project_id);
CREATE INDEX idx_variants_status ON variants(project_id, status);

-- Views
CREATE TABLE views (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    variant_id      UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    viewer_id       TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    watch_duration_ms   INT DEFAULT 0,
    completed       BOOLEAN DEFAULT FALSE,
    referrer        TEXT,
    user_agent      TEXT,
    country_code    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_views_project_id ON views(project_id);
CREATE INDEX idx_views_variant_id ON views(variant_id);
CREATE INDEX idx_views_viewer_id ON views(viewer_id);

-- Processing Jobs
CREATE TABLE processing_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_type        TEXT NOT NULL,
    target_id       UUID NOT NULL,
    bullmq_job_id   TEXT,
    status          TEXT NOT NULL DEFAULT 'queued',
    progress        INT DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_project ON processing_jobs(project_id);
CREATE INDEX idx_processing_jobs_target ON processing_jobs(target_id);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE views ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage segments of own projects"
    ON segments FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage variants of own projects"
    ON variants FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

CREATE POLICY "Anyone can insert views"
    ON views FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Users can view analytics of own projects"
    ON views FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view jobs of own projects"
    ON processing_jobs FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_segments BEFORE UPDATE ON segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_variants BEFORE UPDATE ON variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
