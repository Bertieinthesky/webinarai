/**
 * (dashboard)/page.tsx — Project list (dashboard home)
 *
 * PURPOSE:
 *   The main landing page after login. Displays all of the user's projects
 *   in a card grid with status badges. Includes an empty state with a
 *   "Create Your First Project" CTA when no projects exist yet.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  processing: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  ready: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  archived: { bg: "bg-zinc-500/10", text: "text-zinc-500", dot: "bg-zinc-500" },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} ${status === "processing" ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      setProjects((data as Project[]) || []);
      setLoading(false);
    }
    loadProjects();
  }, [supabase]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your video A/B tests
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border bg-card">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-4 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="mb-1.5 text-base font-semibold text-foreground">
              No projects yet
            </h3>
            <p className="mb-5 max-w-xs text-center text-sm text-muted-foreground">
              Create your first video A/B test to start optimizing your content
            </p>
            <Link href="/projects/new">
              <Button>Create Your First Project</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="group cursor-pointer border-border bg-card transition-all duration-150 hover:border-primary/30 hover:bg-card/80">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-[15px] font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                      {project.name}
                    </CardTitle>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(project.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
