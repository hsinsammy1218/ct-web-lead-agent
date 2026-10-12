import { loadLocalEnv, loadReferenceData, localDataFile, MemoryStore, SupabaseStore } from "@ct/db";

export type AppStore = MemoryStore | SupabaseStore;

let singleton: AppStore | undefined;

export function getStore(): AppStore {
  if (singleton) return singleton;
  loadLocalEnv();
  const reference = loadReferenceData();
  const caps = {
    dailyCapUsd: Number(process.env.DAILY_API_CAP_USD ?? 5),
    monthlyCapUsd: Number(process.env.MONTHLY_API_CAP_USD ?? 50),
  };
  if (process.env.DATA_DRIVER === "supabase") {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Supabase URL and secret key are required on the server");
    singleton = new SupabaseStore(url, key, reference, caps);
  } else {
    singleton = new MemoryStore(localDataFile(), reference, caps);
  }
  return singleton;
}
