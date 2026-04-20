"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-context";
import { LoadingPanel } from "@/components/ui";

export default function WorkspaceRedirectPage() {
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready || !user) {
      return;
    }

    router.replace(user.role === "teacher" ? "/app/teacher" : "/app/student");
  }, [ready, router, user]);

  return (
    <main className="p-6">
      <LoadingPanel label="Opening your workspace..." />
    </main>
  );
}
