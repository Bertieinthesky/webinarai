/**
 * login/page.tsx — Simple password gate
 *
 * PURPOSE:
 *   Clean, minimal login screen. Just "Webinar AI" branding and
 *   a single password field. No email, no signup link.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      setError(true);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="hsl(199 89% 48%)" strokeWidth="1.5" fill="none" />
            <path d="M10 8.5V15.5L16 12L10 8.5Z" fill="hsl(199 89% 48%)" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Webinar <span className="text-primary">AI</span>
        </h1>
      </div>

      {/* Password form */}
      <form onSubmit={handleLogin} className="w-full space-y-4">
        <div>
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            required
            autoFocus
            className={`h-11 bg-card border-border text-center text-sm text-foreground ${
              error ? "border-red-500/50 focus-visible:ring-red-500/30" : ""
            }`}
          />
          {error && (
            <p className="mt-2 text-center text-xs text-red-400">
              Incorrect password
            </p>
          )}
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}
