/**
 * types.ts — Supabase Database type definitions
 *
 * PURPOSE:
 *   Provides full TypeScript types for every table in the database.
 *   These types are used by the Supabase SDK to provide type-safe
 *   queries throughout the entire application.
 *
 * STRUCTURE (per table):
 *   - Row: The shape of a complete row (what you get from SELECT)
 *   - Insert: Fields for INSERT (required + optional with defaults)
 *   - Update: Fields for UPDATE (all optional — only update what changed)
 *   - Relationships: Foreign key relationships (empty for now)
 *
 * TABLES:
 *   - projects: A/B test projects (owned by a user)
 *   - segments: Video segments (hook, body, or CTA) uploaded to a project
 *   - variants: Pre-rendered combinations of hook + body + CTA
 *   - views: Analytics events from embed player views
 *   - processing_jobs: FFmpeg job tracking (normalize + render)
 *
 * GENERATION:
 *   Currently manually typed to match supabase/migrations/001_initial_schema.sql.
 *   Can be replaced with auto-generated types via `supabase gen types typescript`
 *   once the Supabase project is set up.
 *
 * NOTE:
 *   The `Relationships: []` on every table and `CompositeTypes: Record<string, never>`
 *   are required by @supabase/supabase-js v2.98+ to satisfy its generic constraints.
 */

export type SplitStatus = "uploaded" | "splitting" | "completed" | "failed";
export type SplitClipStatus = "pending" | "ready" | "failed";
export type SegmentType = "hook" | "body" | "cta";
export type SegmentStatus =
  | "uploading"
  | "uploaded"
  | "normalizing"
  | "normalized"
  | "failed";
export type VariantStatus = "pending" | "rendering" | "rendered" | "failed";
export type ProjectStatus = "draft" | "processing" | "ready" | "archived";
export type MetricType = "url_rule" | "webhook";
export type MatchType = "contains" | "exact" | "regex";

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          status: ProjectStatus;
          target_width: number;
          target_height: number;
          target_fps: number;
          target_video_codec: string;
          target_audio_codec: string;
          target_audio_rate: number;
          target_pixel_format: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          status?: ProjectStatus;
          target_width?: number;
          target_height?: number;
          target_fps?: number;
          target_video_codec?: string;
          target_audio_codec?: string;
          target_audio_rate?: number;
          target_pixel_format?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          status?: ProjectStatus;
          target_width?: number;
          target_height?: number;
          target_fps?: number;
          target_video_codec?: string;
          target_audio_codec?: string;
          target_audio_rate?: number;
          target_pixel_format?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      segments: {
        Row: {
          id: string;
          project_id: string;
          type: SegmentType;
          label: string;
          sort_order: number;
          original_storage_key: string | null;
          original_filename: string | null;
          original_size_bytes: number | null;
          original_duration_ms: number | null;
          original_width: number | null;
          original_height: number | null;
          original_fps: number | null;
          original_codec: string | null;
          normalized_storage_key: string | null;
          normalized_size_bytes: number | null;
          normalized_duration_ms: number | null;
          status: SegmentStatus;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: SegmentType;
          label: string;
          sort_order?: number;
          original_storage_key?: string | null;
          original_filename?: string | null;
          original_size_bytes?: number | null;
          original_duration_ms?: number | null;
          original_width?: number | null;
          original_height?: number | null;
          original_fps?: number | null;
          original_codec?: string | null;
          normalized_storage_key?: string | null;
          normalized_size_bytes?: number | null;
          normalized_duration_ms?: number | null;
          status?: SegmentStatus;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type?: SegmentType;
          label?: string;
          sort_order?: number;
          original_storage_key?: string | null;
          original_filename?: string | null;
          original_size_bytes?: number | null;
          original_duration_ms?: number | null;
          original_width?: number | null;
          original_height?: number | null;
          original_fps?: number | null;
          original_codec?: string | null;
          normalized_storage_key?: string | null;
          normalized_size_bytes?: number | null;
          normalized_duration_ms?: number | null;
          status?: SegmentStatus;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      variants: {
        Row: {
          id: string;
          project_id: string;
          hook_segment_id: string;
          body_segment_id: string;
          cta_segment_id: string;
          video_storage_key: string | null;
          video_size_bytes: number | null;
          video_duration_ms: number | null;
          hook_clip_storage_key: string | null;
          hook_clip_size_bytes: number | null;
          hook_clip_duration_ms: number | null;
          hook_end_time_ms: number | null;
          micro_segment_storage_key: string | null;
          video_720p_storage_key: string | null;
          video_720p_size_bytes: number | null;
          hls_master_manifest_key: string | null;
          hls_status: string | null;
          hls_error_message: string | null;
          status: VariantStatus;
          error_message: string | null;
          variant_code: string;
          custom_name: string | null;
          weight: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          hook_segment_id: string;
          body_segment_id: string;
          cta_segment_id: string;
          video_storage_key?: string | null;
          video_size_bytes?: number | null;
          video_duration_ms?: number | null;
          hook_clip_storage_key?: string | null;
          hook_clip_size_bytes?: number | null;
          hook_clip_duration_ms?: number | null;
          hook_end_time_ms?: number | null;
          micro_segment_storage_key?: string | null;
          video_720p_storage_key?: string | null;
          video_720p_size_bytes?: number | null;
          hls_master_manifest_key?: string | null;
          hls_status?: string | null;
          hls_error_message?: string | null;
          status?: VariantStatus;
          error_message?: string | null;
          variant_code: string;
          custom_name?: string | null;
          weight?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          hook_segment_id?: string;
          body_segment_id?: string;
          cta_segment_id?: string;
          video_storage_key?: string | null;
          video_size_bytes?: number | null;
          video_duration_ms?: number | null;
          hook_clip_storage_key?: string | null;
          hook_clip_size_bytes?: number | null;
          hook_clip_duration_ms?: number | null;
          hook_end_time_ms?: number | null;
          micro_segment_storage_key?: string | null;
          video_720p_storage_key?: string | null;
          video_720p_size_bytes?: number | null;
          hls_master_manifest_key?: string | null;
          hls_status?: string | null;
          hls_error_message?: string | null;
          status?: VariantStatus;
          error_message?: string | null;
          variant_code?: string;
          custom_name?: string | null;
          weight?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      views: {
        Row: {
          id: string;
          project_id: string;
          variant_id: string;
          viewer_id: string;
          session_id: string;
          started_at: string;
          watch_duration_ms: number;
          completed: boolean;
          referrer: string | null;
          user_agent: string | null;
          country_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          variant_id: string;
          viewer_id: string;
          session_id: string;
          started_at?: string;
          watch_duration_ms?: number;
          completed?: boolean;
          referrer?: string | null;
          user_agent?: string | null;
          country_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          variant_id?: string;
          viewer_id?: string;
          session_id?: string;
          started_at?: string;
          watch_duration_ms?: number;
          completed?: boolean;
          referrer?: string | null;
          user_agent?: string | null;
          country_code?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      processing_jobs: {
        Row: {
          id: string;
          project_id: string;
          job_type: string;
          target_id: string;
          bullmq_job_id: string | null;
          status: string;
          progress: number;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          job_type: string;
          target_id: string;
          bullmq_job_id?: string | null;
          status?: string;
          progress?: number;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          job_type?: string;
          target_id?: string;
          bullmq_job_id?: string | null;
          status?: string;
          progress?: number;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      splits: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          source_storage_key: string;
          source_filename: string | null;
          source_size_bytes: number | null;
          source_duration_ms: number | null;
          source_width: number | null;
          source_height: number | null;
          markers: unknown;
          scene_points: unknown[] | null;
          status: SplitStatus;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          source_storage_key: string;
          source_filename?: string | null;
          source_size_bytes?: number | null;
          source_duration_ms?: number | null;
          source_width?: number | null;
          source_height?: number | null;
          markers?: unknown;
          scene_points?: unknown[] | null;
          status?: SplitStatus;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string | null;
          source_storage_key?: string;
          source_filename?: string | null;
          source_size_bytes?: number | null;
          source_duration_ms?: number | null;
          source_width?: number | null;
          source_height?: number | null;
          markers?: unknown;
          scene_points?: unknown[] | null;
          status?: SplitStatus;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      split_clips: {
        Row: {
          id: string;
          split_id: string;
          clip_index: number;
          label: string;
          start_ms: number;
          end_ms: number;
          storage_key: string | null;
          size_bytes: number | null;
          duration_ms: number | null;
          status: SplitClipStatus;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          split_id: string;
          clip_index: number;
          label: string;
          start_ms: number;
          end_ms: number;
          storage_key?: string | null;
          size_bytes?: number | null;
          duration_ms?: number | null;
          status?: SplitClipStatus;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          split_id?: string;
          clip_index?: number;
          label?: string;
          start_ms?: number;
          end_ms?: number;
          storage_key?: string | null;
          size_bytes?: number | null;
          duration_ms?: number | null;
          status?: SplitClipStatus;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      view_events: {
        Row: {
          id: string;
          project_id: string;
          variant_id: string;
          viewer_id: string;
          session_id: string;
          event_type: string;
          timestamp_ms: number;
          referrer: string | null;
          user_agent: string | null;
          country_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          variant_id: string;
          viewer_id: string;
          session_id: string;
          event_type: string;
          timestamp_ms: number;
          referrer?: string | null;
          user_agent?: string | null;
          country_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          variant_id?: string;
          viewer_id?: string;
          session_id?: string;
          event_type?: string;
          timestamp_ms?: number;
          referrer?: string | null;
          user_agent?: string | null;
          country_code?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      custom_metrics: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          metric_type: MetricType;
          url_pattern: string | null;
          match_type: MatchType | null;
          webhook_key: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          metric_type?: MetricType;
          url_pattern?: string | null;
          match_type?: MatchType | null;
          webhook_key?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          metric_type?: MetricType;
          url_pattern?: string | null;
          match_type?: MatchType | null;
          webhook_key?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      custom_metric_events: {
        Row: {
          id: string;
          metric_id: string;
          project_id: string;
          variant_id: string | null;
          viewer_id: string;
          session_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          metric_id: string;
          project_id: string;
          variant_id?: string | null;
          viewer_id: string;
          session_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          metric_id?: string;
          project_id?: string;
          variant_id?: string | null;
          viewer_id?: string;
          session_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_variant_analytics: {
        Args: {
          p_project_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          variant_id: string;
          variant_code: string;
          custom_name: string | null;
          total_views: number;
          unique_viewers: number;
          play_count: number;
          progress_25_count: number;
          progress_50_count: number;
          progress_75_count: number;
          complete_count: number;
          completion_rate: number;
        }[];
      };
      get_segment_analytics: {
        Args: {
          p_project_id: string;
          p_segment_type: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          segment_id: string;
          segment_label: string;
          total_views: number;
          unique_viewers: number;
          complete_count: number;
          completion_rate: number;
        }[];
      };
      get_daily_views: {
        Args: {
          p_project_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          day: string;
          variant_id: string;
          variant_code: string;
          views: number;
          completions: number;
        }[];
      };
    };
    Enums: {
      segment_type: SegmentType;
      segment_status: SegmentStatus;
      variant_status: VariantStatus;
      project_status: ProjectStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
