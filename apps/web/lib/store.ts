import { loadLocalEnv, loadReferenceData, localDataFile, MemoryStore, SupabaseStore } from "@ct/db";
import type { ReferenceData } from "@ct/core";

export type AppStore = MemoryStore | SupabaseStore;

let singleton: AppStore | undefined;

/** Normalize thrown values (Postgrest errors are plain objects) into Error. */
export function storeError(caught: unknown, fallback = "The lead store is unavailable"): Error {
  if (caught instanceof Error) return caught;
  if (caught && typeof caught === "object") {
    const row = caught as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [row.message, row.details, row.hint, row.code]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length) {
      const message = parts.join(" — ");
      if (/failed to fetch|fetch failed|enotfound|econnrefused|network/i.test(message)) {
        return new Error(
          "Supabase is unreachable right now. If the project was paused for inactivity, restore it in the Supabase dashboard, then reload.",
        );
      }
      return new Error(message);
    }
  }
  if (typeof caught === "string" && caught.trim()) return new Error(caught.trim());
  return new Error(fallback);
}

export function getStore(): AppStore {
  if (singleton) return singleton;
  loadLocalEnv();
  let reference;
  try {
    reference = loadReferenceData();
  } catch (error) {
    throw storeError(error, "Could not load CT reference data (config/ct).");
  }
  const caps = {
    dailyCapUsd: Number(process.env.DAILY_API_CAP_USD ?? 5),
    monthlyCapUsd: Number(process.env.MONTHLY_API_CAP_USD ?? 50),
  };
  if (process.env.DATA_DRIVER === "supabase") {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY on the Vercel project, then redeploy.",
      );
    }
    singleton = new SupabaseStore(url, key, reference, caps);
  } else {
    singleton = new MemoryStore(localDataFile(), reference, caps);
  }
  return singleton;
}

/** Industries (and other reference) for forms — prefers live Supabase rows when available. */
export async function getReferenceData(): Promise<ReferenceData> {
  const store = getStore();
  if ("liveReferenceData" in store && typeof store.liveReferenceData === "function") {
    return store.liveReferenceData();
  }
  return store.referenceData();
}
