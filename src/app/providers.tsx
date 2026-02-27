/**
 * providers.tsx — Client-side provider wrapper
 *
 * PURPOSE:
 *   Wraps the app tree with TanStack Query's QueryClientProvider so all
 *   components can use useQuery/useMutation for server state management.
 *
 * WHY useState FOR QueryClient:
 *   Creating the QueryClient inside useState ensures each browser tab gets
 *   its own instance, preventing shared state across tabs. It also avoids
 *   re-creating the client on every render.
 *
 * DEFAULT OPTIONS:
 *   - staleTime: 1 minute (data considered fresh for 60s before re-fetching)
 *   - retry: 1 (retry failed queries once before showing error)
 */

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
