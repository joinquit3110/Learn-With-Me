import { ArrowRight, BrainCircuit, Camera, GraduationCap, NotebookPen, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_25%),linear-gradient(180deg,_#fffdf8_0%,_#f4f7fb_55%,_#edf2f7_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent)]" />

      <section className="mx-auto flex min-h-screen max-w-[1240px] flex-col justify-center px-6 py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-4 py-2 text-sm text-slate-700 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] backdrop-blur">
              <BrainCircuit size={16} className="text-teal-700" />
              AI-guided mathematics practice for classrooms and self-study
            </div>

            <div className="space-y-5">
              <h1 className="font-display text-5xl leading-[0.95] text-slate-950 sm:text-6xl lg:text-7xl">
                Learn With Me
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                A real teacher-student learning system where AI grades reasoning, spots mistakes from text
                and images, asks guiding questions instead of leaking answers, and turns every solved problem
                into revision-ready notebook pages.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold !text-white shadow-[0_20px_55px_-30px_rgba(15,23,42,0.8)] transition hover:bg-slate-800 [&_svg]:text-white"
              >
                Launch Workspace
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/75 px-6 py-3 text-sm font-semibold !text-slate-950 backdrop-blur transition hover:border-slate-400 hover:bg-white"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="mesh-panel rounded-[36px] border border-white/70 bg-white/70 p-6 shadow-[0_28px_100px_-56px_rgba(15,23,42,0.5)] backdrop-blur-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: GraduationCap,
                  title: "Teacher Mode",
                  description: "Author exercises, generate Socratic hints, track blind spots, and flag stuck learners.",
                },
                {
                  icon: Camera,
                  title: "Image Feedback",
                  description: "Upload handwritten work and receive pinpoint hotspot guidance on the actual mistake line.",
                },
                {
                  icon: NotebookPen,
                  title: "Digital Notebook",
                  description: "Every solved exercise becomes a reflection page with errors, fixes, and aha moments.",
                },
                {
                  icon: ShieldCheck,
                  title: "Safe Guardrails",
                  description: "Prompt injection and off-topic questions get redirected back into the math journey.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[28px] border border-slate-200/70 bg-white/80 p-5"
                >
                  <feature.icon size={18} className="text-teal-700" />
                  <h2 className="mt-4 font-display text-2xl text-slate-950">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
