-- =============================================================
-- Migration 005: Analytics & Variant Management
--
-- Adds:
--   - view_events: Granular event tracking (play, progress, complete)
--   - custom_metrics: User-defined conversion metrics
--   - custom_metric_events: Conversion events for custom metrics
--   - variants.custom_name: Human-readable variant names
--   - RPC functions for efficient analytics aggregation
-- =============================================================

-- -----------------------------------------------
-- 1. view_events — Raw event tracking
-- -----------------------------------------------
CREATE TABLE view_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    variant_id      UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    viewer_id       TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    event_type      TEXT NOT NULL,         -- play, progress_25, progress_50, progress_75, complete
    timestamp_ms    BIGINT NOT NULL,
    referrer        TEXT,
    user_agent      TEXT,
    country_code    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_view_events_project_id ON view_events(project_id);
CREATE INDEX idx_view_events_variant_id ON view_events(variant_id);
CREATE INDEX idx_view_events_project_created ON view_events(project_id, created_at);
CREATE INDEX idx_view_events_viewer_id ON view_events(viewer_id);

-- -----------------------------------------------
-- 2. custom_metrics — Conversion metric definitions
-- -----------------------------------------------
CREATE TABLE custom_metrics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    metric_type     TEXT NOT NULL DEFAULT 'url_rule',   -- 'url_rule' | 'webhook'
    url_pattern     TEXT,
    match_type      TEXT DEFAULT 'contains',            -- 'contains' | 'exact' | 'regex'
    webhook_key     TEXT UNIQUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_metrics_project ON custom_metrics(project_id);
CREATE INDEX idx_custom_metrics_webhook ON custom_metrics(webhook_key);

-- -----------------------------------------------
-- 3. custom_metric_events — Conversion events
-- -----------------------------------------------
CREATE TABLE custom_metric_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_id       UUID NOT NULL REFERENCES custom_metrics(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    variant_id      UUID REFERENCES variants(id) ON DELETE SET NULL,
    viewer_id       TEXT NOT NULL,
    session_id      TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_metric_events_metric ON custom_metric_events(metric_id);
CREATE INDEX idx_custom_metric_events_project ON custom_metric_events(project_id);
CREATE INDEX idx_custom_metric_events_variant ON custom_metric_events(variant_id);

-- -----------------------------------------------
-- 4. Variant naming column
-- -----------------------------------------------
ALTER TABLE variants ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- -----------------------------------------------
-- 5. RLS policies
-- -----------------------------------------------
ALTER TABLE view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metric_events ENABLE ROW LEVEL SECURITY;

-- view_events: anyone can INSERT (public tracking), owners can SELECT
CREATE POLICY "Anyone can insert view events"
    ON view_events FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can view own project events"
    ON view_events FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

-- custom_metrics: owners can manage
CREATE POLICY "Users can manage own project metrics"
    ON custom_metrics FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

-- custom_metric_events: anyone can INSERT (webhook/tracking), owners can SELECT
CREATE POLICY "Anyone can insert metric events"
    ON custom_metric_events FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can view own metric events"
    ON custom_metric_events FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

-- -----------------------------------------------
-- 6. Updated_at trigger for custom_metrics
-- -----------------------------------------------
CREATE TRIGGER set_updated_at_custom_metrics BEFORE UPDATE ON custom_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------
-- 7. RPC: get_variant_analytics
-- Returns per-variant aggregated analytics for a project within a date range.
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION get_variant_analytics(
    p_project_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    variant_id UUID,
    variant_code TEXT,
    custom_name TEXT,
    total_views BIGINT,
    unique_viewers BIGINT,
    play_count BIGINT,
    progress_25_count BIGINT,
    progress_50_count BIGINT,
    progress_75_count BIGINT,
    complete_count BIGINT,
    completion_rate NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id AS variant_id,
        v.variant_code,
        v.custom_name,
        COUNT(DISTINCT CASE WHEN ve.event_type = 'play' THEN ve.id END) AS total_views,
        COUNT(DISTINCT ve.viewer_id) AS unique_viewers,
        COUNT(CASE WHEN ve.event_type = 'play' THEN 1 END) AS play_count,
        COUNT(CASE WHEN ve.event_type = 'progress_25' THEN 1 END) AS progress_25_count,
        COUNT(CASE WHEN ve.event_type = 'progress_50' THEN 1 END) AS progress_50_count,
        COUNT(CASE WHEN ve.event_type = 'progress_75' THEN 1 END) AS progress_75_count,
        COUNT(CASE WHEN ve.event_type = 'complete' THEN 1 END) AS complete_count,
        CASE
            WHEN COUNT(CASE WHEN ve.event_type = 'play' THEN 1 END) > 0
            THEN ROUND(
                COUNT(CASE WHEN ve.event_type = 'complete' THEN 1 END)::NUMERIC /
                COUNT(CASE WHEN ve.event_type = 'play' THEN 1 END)::NUMERIC * 100,
                2
            )
            ELSE 0
        END AS completion_rate
    FROM variants v
    LEFT JOIN view_events ve ON ve.variant_id = v.id
        AND (p_start_date IS NULL OR ve.created_at >= p_start_date)
        AND (p_end_date IS NULL OR ve.created_at <= p_end_date)
    WHERE v.project_id = p_project_id
      AND v.status = 'rendered'
    GROUP BY v.id, v.variant_code, v.custom_name
    ORDER BY total_views DESC;
END;
$$;

-- -----------------------------------------------
-- 8. RPC: get_segment_analytics
-- Aggregates analytics by segment (hook, body, or cta) for comparison.
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION get_segment_analytics(
    p_project_id UUID,
    p_segment_type TEXT,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    segment_id UUID,
    segment_label TEXT,
    total_views BIGINT,
    unique_viewers BIGINT,
    complete_count BIGINT,
    completion_rate NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id AS segment_id,
        s.label AS segment_label,
        COUNT(DISTINCT CASE WHEN ve.event_type = 'play' THEN ve.id END) AS total_views,
        COUNT(DISTINCT ve.viewer_id) AS unique_viewers,
        COUNT(CASE WHEN ve.event_type = 'complete' THEN 1 END) AS complete_count,
        CASE
            WHEN COUNT(CASE WHEN ve.event_type = 'play' THEN 1 END) > 0
            THEN ROUND(
                COUNT(CASE WHEN ve.event_type = 'complete' THEN 1 END)::NUMERIC /
                COUNT(CASE WHEN ve.event_type = 'play' THEN 1 END)::NUMERIC * 100,
                2
            )
            ELSE 0
        END AS completion_rate
    FROM segments s
    JOIN variants v ON
        (p_segment_type = 'hook' AND v.hook_segment_id = s.id) OR
        (p_segment_type = 'body' AND v.body_segment_id = s.id) OR
        (p_segment_type = 'cta' AND v.cta_segment_id = s.id)
    LEFT JOIN view_events ve ON ve.variant_id = v.id
        AND (p_start_date IS NULL OR ve.created_at >= p_start_date)
        AND (p_end_date IS NULL OR ve.created_at <= p_end_date)
    WHERE s.project_id = p_project_id
      AND s.type = p_segment_type::segment_type
    GROUP BY s.id, s.label
    ORDER BY total_views DESC;
END;
$$;

-- -----------------------------------------------
-- 9. RPC: get_daily_views
-- Returns daily aggregated view counts for charting.
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION get_daily_views(
    p_project_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    day DATE,
    variant_id UUID,
    variant_code TEXT,
    views BIGINT,
    completions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ve.created_at::DATE AS day,
        v.id AS variant_id,
        v.variant_code,
        COUNT(CASE WHEN ve.event_type = 'play' THEN 1 END) AS views,
        COUNT(CASE WHEN ve.event_type = 'complete' THEN 1 END) AS completions
    FROM view_events ve
    JOIN variants v ON v.id = ve.variant_id
    WHERE ve.project_id = p_project_id
        AND (p_start_date IS NULL OR ve.created_at >= p_start_date)
        AND (p_end_date IS NULL OR ve.created_at <= p_end_date)
    GROUP BY ve.created_at::DATE, v.id, v.variant_code
    ORDER BY day;
END;
$$;
