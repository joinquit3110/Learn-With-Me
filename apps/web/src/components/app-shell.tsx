"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  NotebookTabs,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/lib/cn";

import { useAuth } from "./auth-context";
import { Button, LoadingPanel } from "./ui";

const teacherLinks = [
  {
    href: "/app/teacher",
    label: "Overview",
    icon: LayoutDashboard,
    matchPrefixes: ["/app/teacher"],
  },
  {
    href: "/app/teacher",
    label: "Classes",
    icon: Users,
    matchPrefixes: ["/app/classes", "/app/exercises"],
  },
];

const studentLinks = [
  {
    href: "/app/student",
    label: "Overview",
    icon: Home,
    matchPrefixes: ["/app/student"],
  },
  {
    href: "/app/notebook",
    label: "Notebook",
    icon: NotebookTabs,
    matchPrefixes: ["/app/notebook"],
  },
  {
    href: "/app/student",
    label: "Practice",
    icon: BookOpen,
    matchPrefixes: ["/app/classes", "/app/exercises"],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearSession, ready, user } = useAuth();

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, router, user]);

  if (!ready || !user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-20">
        <LoadingPanel label="Loading your workspace..." />
      </main>
    );
  }

  const links = user.role === "teacher" ? teacherLinks : studentLinks;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_24%),linear-gradient(180deg,_#fffdf7_0%,_#f4f7fb_55%,_#eef3f7_100%)]" />
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-teal-200/25 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="lg:w-[280px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-4 rounded-[32px] border border-slate-800 bg-slate-950 px-5 py-6 text-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.8)]"
          >
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-300 to-teal-300 text-slate-950">
                {user.role === "teacher" ? <GraduationCap size={20} /> : <BrainCircuit size={20} />}
              </div>
              <div>
                <p className="font-display text-2xl">Learn With Me</p>
                <p className="text-sm text-white/70">
                  {user.role === "teacher" ? "Teacher Studio" : "Student Workspace"}
                </p>
              </div>
            </Link>

            <div className="mt-8 rounded-[28px] border border-white/12 bg-white/8 p-4">
              <p className="text-sm text-white/60">Signed in as</p>
              <p className="mt-1 text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-white/60">{user.email}</p>
              <div className="mt-4 flex gap-2 text-xs text-white/75">
                <span className="rounded-full bg-white/10 px-3 py-1">XP {user.stats.xp}</span>
                <span className="rounded-full bg-white/10 px-3 py-1">Streak {user.stats.streak}</span>
              </div>
            </div>

            <nav className="mt-6 space-y-2">
              {links.map((link) => {
                const Icon = link.icon;
                const active =
                  link.matchPrefixes?.some(
                    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
                  ) ?? (pathname === link.href || pathname.startsWith(`${link.href}/`));

                return (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                      active
                        ? "bg-white text-slate-950 shadow-[0_18px_50px_-30px_rgba(255,255,255,0.9)] [&_svg]:text-slate-950 [&_span]:text-slate-950"
                        : "text-white/80 hover:bg-white/10 hover:text-white [&_svg]:text-white/80 [&_span]:text-white/80 hover:[&_svg]:text-white hover:[&_span]:text-white",
                    )}
                  >
                    <Icon size={18} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <Button
              variant="ghost"
              className="mt-6 w-full justify-start !text-white hover:bg-white/10 hover:!text-white"
              onClick={() => {
                clearSession();
                router.push("/login");
              }}
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </motion.div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
