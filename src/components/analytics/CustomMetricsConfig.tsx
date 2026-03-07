/**
 * CustomMetricsConfig — Dialog for managing custom conversion metrics
 *
 * Lists existing metrics, lets users add URL rules or webhooks,
 * edit, delete, and copy webhook URLs.
 */

"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CustomMetric {
  id: string;
  name: string;
  metric_type: "url_rule" | "webhook";
  url_pattern: string | null;
  match_type: "contains" | "exact" | "regex";
  webhook_key: string | null;
  description: string | null;
  created_at: string;
}

interface CustomMetricsConfigProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

type MetricForm = {
  name: string;
  metric_type: "url_rule" | "webhook";
  url_pattern: string;
  match_type: "contains" | "exact" | "regex";
  description: string;
};

const emptyForm: MetricForm = {
  name: "",
  metric_type: "url_rule",
  url_pattern: "",
  match_type: "contains",
  description: "",
};

function useCustomMetrics(projectId: string) {
  return useQuery<{ metrics: CustomMetric[] }>({
    queryKey: ["custom-metrics", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/metrics`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
  });
}

export function CustomMetricsConfig({
  projectId,
  open,
  onClose,
}: CustomMetricsConfigProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useCustomMetrics(projectId);
  const metrics = data?.metrics || [];

  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [form, setForm] = useState<MetricForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["custom-metrics", projectId] });
  }, [queryClient, projectId]);

  const createMutation = useMutation({
    mutationFn: async (data: MetricForm) => {
      const res = await fetch(`/api/projects/${projectId}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create metric");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setView("list");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MetricForm> }) => {
      const res = await fetch(`/api/projects/${projectId}/metrics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update metric");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setEditingId(null);
      setView("list");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${projectId}/metrics/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete metric");
    },
    onSuccess: invalidate,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (view === "edit" && editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function startEdit(m: CustomMetric) {
    setForm({
      name: m.name,
      metric_type: m.metric_type,
      url_pattern: m.url_pattern || "",
      match_type: m.match_type || "contains",
      description: m.description || "",
    });
    setEditingId(m.id);
    setView("edit");
  }

  function copyWebhookUrl(key: string) {
    const url = `${window.location.origin}/api/webhook/${key}`;
    navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!open) return null;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-sm font-medium text-white/80">
            {view === "list"
              ? "Custom Metrics"
              : view === "add"
                ? "Add Metric"
                : "Edit Metric"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {view === "list" ? (
            <div className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
                  ))}
                </div>
              ) : metrics.length === 0 ? (
                <div className="py-8 text-center">
                  <svg className="mx-auto h-8 w-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2 text-xs text-white/30">
                    No custom metrics yet
                  </p>
                  <p className="mt-1 text-[11px] text-white/15">
                    Track conversions with URL rules or webhooks
                  </p>
                </div>
              ) : (
                metrics.map((m) => (
                  <div
                    key={m.id}
                    className="group rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-white/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/70">
                            {m.name}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              m.metric_type === "webhook"
                                ? "bg-violet-500/10 text-violet-400/80"
                                : "bg-sky-500/10 text-sky-400/80"
                            }`}
                          >
                            {m.metric_type === "webhook" ? "Webhook" : "URL Rule"}
                          </span>
                        </div>

                        {m.metric_type === "url_rule" && m.url_pattern && (
                          <p className="mt-1 truncate font-mono text-[11px] text-white/25">
                            {m.match_type}: {m.url_pattern}
                          </p>
                        )}

                        {m.metric_type === "webhook" && m.webhook_key && (
                          <button
                            onClick={() => copyWebhookUrl(m.webhook_key!)}
                            className="mt-1 flex items-center gap-1 text-[11px] text-white/25 transition-colors hover:text-white/50"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            {copied === m.webhook_key ? (
                              <span className="text-emerald-400">Copied!</span>
                            ) : (
                              <span>Copy webhook URL</span>
                            )}
                          </button>
                        )}

                        {m.description && (
                          <p className="mt-1 text-[11px] text-white/20">
                            {m.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="ml-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEdit(m)}
                          className="rounded p-1 text-white/20 transition-colors hover:bg-white/5 hover:text-white/50"
                          title="Edit"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${m.name}"? This will also delete all conversion events for this metric.`)) {
                              deleteMutation.mutate(m.id);
                            }
                          }}
                          className="rounded p-1 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400/70"
                          title="Delete"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Add / Edit form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Metric type toggle (only on add) */}
              {view === "add" && (
                <div className="flex rounded-lg border border-white/10 p-0.5">
                  {(["url_rule", "webhook"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, metric_type: type }))}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        form.metric_type === type
                          ? "bg-white/10 text-white/80"
                          : "text-white/30 hover:text-white/50"
                      }`}
                    >
                      {type === "url_rule" ? "URL Rule" : "Webhook"}
                    </button>
                  ))}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Checkout Page Visit"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                  autoFocus
                />
              </div>

              {/* URL Rule fields */}
              {form.metric_type === "url_rule" && (
                <>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30 mb-1.5">
                      Match Type
                    </label>
                    <div className="flex rounded-lg border border-white/10 p-0.5">
                      {(["contains", "exact", "regex"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, match_type: type }))}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            form.match_type === type
                              ? "bg-white/10 text-white/80"
                              : "text-white/30 hover:text-white/50"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30 mb-1.5">
                      URL Pattern
                    </label>
                    <input
                      type="text"
                      value={form.url_pattern}
                      onChange={(e) => setForm((f) => ({ ...f, url_pattern: e.target.value }))}
                      placeholder={
                        form.match_type === "contains"
                          ? "/thank-you"
                          : form.match_type === "exact"
                            ? "https://example.com/checkout/success"
                            : "/order/\\d+/confirm"
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white/80 placeholder:text-white/15 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                    />
                    <p className="mt-1 text-[10px] text-white/20">
                      {form.match_type === "contains"
                        ? "Matches if the page URL contains this text"
                        : form.match_type === "exact"
                          ? "Matches if the page URL exactly equals this value"
                          : "Matches using a JavaScript regular expression"}
                    </p>
                  </div>
                </>
              )}

              {/* Webhook info */}
              {form.metric_type === "webhook" && (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-xs text-white/40">
                    A unique webhook URL will be generated when you save this metric.
                    Send a POST request to it with a JSON body containing{" "}
                    <code className="rounded bg-white/5 px-1 py-0.5 text-[11px] text-white/50">
                      {"{ \"viewerId\": \"...\" }"}
                    </code>{" "}
                    to record a conversion.
                  </p>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30 mb-1.5">
                  Description
                  <span className="ml-1 text-white/15">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this metric track?"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setForm(emptyForm);
                    setEditingId(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs text-white/30 transition-colors hover:text-white/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!form.name.trim() || isSaving}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/80 disabled:opacity-40"
                >
                  {isSaving ? "Saving..." : view === "edit" ? "Update" : "Create"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer (list view) */}
        {view === "list" && (
          <div className="border-t border-white/10 px-6 py-3">
            <button
              onClick={() => {
                setForm(emptyForm);
                setView("add");
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Metric
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
