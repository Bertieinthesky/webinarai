/**
 * (dashboard)/layout.tsx — Authenticated dashboard layout
 *
 * PURPOSE:
 *   Provides the two-column layout for all authenticated dashboard pages:
 *   a fixed sidebar on the left with navigation and sign-out, and a
 *   scrollable main content area on the right.
 *
 * LAYOUT:
 *   ┌──────────┬──────────────────────────────────┐
 *   │          │                                  │
 *   │ Sidebar  │    Main content (children)       │
 *   │ (fixed)  │    max-width 6xl, centered       │
 *   │          │                                  │
 *   └──────────┴──────────────────────────────────┘
 *
 * AUTH PROTECTION:
 *   This layout itself doesn't check auth — that's handled by the
 *   middleware (src/middleware.ts) which redirects unauthenticated
 *   users to /login before they ever reach this layout.
 *
 * USED BY:
 *   - / (project list)
 *   - /projects/new (create project)
 *   - /projects/[id] (project detail)
 *   - /projects/[id]/upload, /preview, /embed
 */

import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[hsl(220_14%_5.5%)]">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
