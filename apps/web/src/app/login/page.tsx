"use client";

import { startTransition, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-context";
import { Button, Card, Input } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { PublicUser } from "@/lib/contracts";

export default function LoginPage() {
  const router = useRouter();
  const { ready, setSession, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace("/app");
    }
  }, [ready, router, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await apiRequest<{ token: string; user: PublicUser }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSession(response.token, response.user);
      startTransition(() => {
        router.push("/app");
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.15),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_22%),linear-gradient(180deg,_#fffdf8_0%,_#f4f7fb_100%)] px-6 py-16">
      <Card className="w-full max-w-xl rounded-[34px] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Welcome back</p>
        <h1 className="mt-3 font-display text-5xl text-slate-950">Sign In</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Continue your teacher studio or student workspace.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting ? "Signing in..." : "Enter workspace"}
            <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          No account yet?{" "}
          <Link href="/register" className="font-semibold text-teal-700">
            Create one
          </Link>
        </p>
      </Card>
    </main>
  );
}
