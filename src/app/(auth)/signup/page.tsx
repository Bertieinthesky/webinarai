/**
 * signup/page.tsx — New account registration page
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div>
      {/* Logo */}
      <div className="mb-8 flex items-center justify-center gap-2">
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <path d="M8 5.5L22 14L8 22.5V5.5Z" fill="hsl(199 89% 48%)" opacity="0.9" />
          <path d="M12 10L18 14L12 18" stroke="hsl(199 50% 6%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-lg font-semibold tracking-tight text-foreground">
          webinar<span className="text-primary">.ai</span>
        </span>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-4 pt-6 text-center">
          <h1 className="text-base font-semibold text-foreground">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Get started with video A/B testing</p>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4 pb-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/80">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-background border-border"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-6">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:text-primary/80">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
