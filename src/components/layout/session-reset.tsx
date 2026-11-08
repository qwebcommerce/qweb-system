"use client";

import { useEffect } from "react";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";

export function SessionReset() {
  useEffect(() => {
    fetch("/api/auth/session", { method: "DELETE" }).finally(() => {
      window.location.replace("/login");
    });
  }, []);

  return <ShellSkeleton />;
}
