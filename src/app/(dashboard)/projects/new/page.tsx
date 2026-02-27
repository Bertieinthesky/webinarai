/**
 * projects/new/page.tsx — Create new project form
 *
 * PURPOSE:
 *   Simple form to create a new video A/B test project. The user only
 *   needs to enter a name — a unique URL slug is auto-generated.
 *   After creation, the user is immediately redirected to the upload page.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateSlug } from "@/lib/utils/slug";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in");
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        slug: generateSlug(),
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/projects/${(data as Project).id}/upload`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-[15px] font-medium text-foreground">New Project</CardTitle>
          <CardDescription>
            Create a new video A/B test. Upload your hooks, bodies, and CTAs
            to get started.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreate}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground/80">Project Name</Label>
              <Input
                id="name"
                placeholder="e.g., Q1 VSL Test"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
