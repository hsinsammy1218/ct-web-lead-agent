import { loadLocalEnv, loadReferenceData, localDataFile, MemoryStore, SupabaseStore } from "@ct/db";
import { processItem } from "./pipeline.js";

function store(): MemoryStore | SupabaseStore {
  loadLocalEnv();
  const reference = loadReferenceData();
  const caps = {
    dailyCapUsd: Number(process.env.DAILY_API_CAP_USD ?? 5),
    monthlyCapUsd: Number(process.env.MONTHLY_API_CAP_USD ?? 50),
  };
  if (process.env.DATA_DRIVER === "supabase") {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
    const supabase = new SupabaseStore(url, key, reference, caps);
    return supabase;
  }
  return new MemoryStore(localDataFile(), reference, caps);
}

async function main(): Promise<void> {
  const jobs = store();
  if (jobs instanceof SupabaseStore) await jobs.seedReference();
  const once = process.argv.includes("--once");
  const maintenance = process.argv.includes("--maintenance");
  if (maintenance) {
    await jobs.enqueueJob("reaudit.enqueue", `reaudit:${new Date().toISOString().slice(0, 10)}`, {});
    await jobs.enqueueJob("retention.cleanup", `retention:${new Date().toISOString().slice(0, 10)}`, {});
    return;
  }
  for (;;) {
    const item = await jobs.claim();
    if (!item) {
      if (once) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    try {
      await processItem(jobs, item);
      await jobs.succeed(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      console.error(message);
      await jobs.fail(item.id, message);
    }
  }
}

const pending = main();
pending.catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
