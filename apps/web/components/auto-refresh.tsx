"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soft-refresh the server page while pipeline work is active. */
export function AutoRefresh({ active, seconds = 8 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [active, router, seconds]);
  return null;
}
