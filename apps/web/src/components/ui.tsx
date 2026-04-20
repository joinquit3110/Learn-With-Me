"use client";

import type { HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_24px_80px_-48px_rgba(16,24,40,0.55)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/35 disabled:cursor-not-allowed disabled:opacity-100 [&_svg]:shrink-0 [&_svg]:text-current",
        variant === "primary" &&
          "bg-slate-950 !text-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.75)] hover:bg-slate-800 disabled:bg-slate-300 disabled:!text-slate-600 disabled:shadow-none",
        variant === "secondary" &&
          "border border-slate-300 bg-white !text-slate-950 hover:border-slate-400 hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:!text-slate-500",
        variant === "ghost" &&
          "!text-slate-800 hover:bg-slate-100 disabled:!text-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-3xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/60 bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-950",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">{eyebrow}</p>
      <h2 className="font-display text-3xl text-slate-950 sm:text-4xl">{title}</h2>
      {description ? <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed bg-white/50 text-center", className)}>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Card>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <Card className="animate-pulse">
      <div className="h-4 w-24 rounded-full bg-slate-200" />
      <div className="mt-4 h-10 w-full rounded-3xl bg-slate-100" />
      <div className="mt-3 h-10 w-4/5 rounded-3xl bg-slate-100" />
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </Card>
  );
}
