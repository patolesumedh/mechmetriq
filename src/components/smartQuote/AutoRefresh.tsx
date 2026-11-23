"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the page every few seconds while a CAD analysis is running, so
 * results appear without a manual reload. Stops after `maxMs`.
 */
export function AutoRefresh({
  active,
  intervalMs = 5000,
  maxMs = 5 * 60 * 1000,
}: {
  active: boolean;
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > maxMs) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, maxMs, router]);

  return null;
}
