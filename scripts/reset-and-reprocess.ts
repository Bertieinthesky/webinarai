/**
 * Reset failed segments and re-trigger processing.
 * Run: npx tsx scripts/reset-and-reprocess.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Reset all failed segments back to "uploaded"
  const { data: segments, error: segErr } = await supabase
    .from("segments")
    .update({ status: "uploaded", error_message: null })
    .in("status", ["failed", "normalizing"])
    .select("id, project_id, status");

  if (segErr) {
    console.error("Failed to reset segments:", segErr.message);
    return;
  }
  console.log(`Reset ${segments?.length || 0} segments to "uploaded"`);

  // Reset all processing projects back to "draft"
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .update({ status: "draft" })
    .eq("status", "processing")
    .select("id, name");

  if (projErr) {
    console.error("Failed to reset projects:", projErr.message);
    return;
  }
  console.log(`Reset ${projects?.length || 0} projects to "draft"`);

  // Delete existing variants (they'll be recreated on reprocess)
  if (projects && projects.length > 0) {
    for (const p of projects) {
      const { error: delErr } = await supabase
        .from("variants")
        .delete()
        .eq("project_id", p.id);
      if (delErr) console.error(`Failed to delete variants for ${p.name}:`, delErr.message);
      else console.log(`Deleted variants for project: ${p.name}`);

      // Delete old processing jobs
      await supabase
        .from("processing_jobs")
        .delete()
        .eq("project_id", p.id);
    }
  }

  console.log("\nDone! Go to each project and click 'Process All Variants' again.");
}

main().catch(console.error);
