"use client";

import { startTransition, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-context";
import { Button, Card, Input, Select } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { PublicUser, Role } from "@/lib/contracts";

export default function RegisterPage() {
  const router = useRouter();
  const { ready, setSession, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace("/app");
    }
  }, [ready, router, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiRequest<{ token: string; user: PublicUser }>("/auth/register", {
        method: "POST",
        body: { name: trimmedName, email: trimmedEmail, password, role },
      });
      setSession(response.token, response.user);
      startTransition(() => {
        router.push("/app");
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.15),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_22%),linear-gradient(180deg,_#fffdf8_0%,_#f4f7fb_100%)] px-6 py-16">
      <Card className="w-full max-w-xl rounded-[34px] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Start here</p>
        <h1 className="mt-3 font-display text-5xl text-slate-950">Create Your Account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Spin up a teacher studio or a student learning space in one step.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            autoComplete="name"
            required
          />
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
          <p className="px-1 text-xs text-slate-500">Use at least 8 characters for the password.</p>
          <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </Select>
          <Button type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting ? "Creating account..." : "Launch workspace"}
            <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-teal-700">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
