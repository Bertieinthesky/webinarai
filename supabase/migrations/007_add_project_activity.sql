-- Project activity log: append-only ledger of project management events
-- Used for the Activity feed in the project detail page

CREATE TABLE project_activity (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,       -- e.g. 'segment_uploaded', 'processing_started', 'variant_rendered'
    title           TEXT NOT NULL,       -- Human-readable: "New hook added"
    detail          TEXT,                -- Optional: segment label, variant code, error message
    metadata        JSONB DEFAULT '{}',  -- Structured data: { segmentId, variantCode, etc. }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_activity_project ON project_activity(project_id, created_at DESC);

ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity of own projects"
    ON project_activity FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

-- Dual Clutch HLS manifest key (from previous feature)
ALTER TABLE variants ADD COLUMN IF NOT EXISTS dual_clutch_manifest_key TEXT;
