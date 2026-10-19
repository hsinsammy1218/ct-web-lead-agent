"use client";

export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const omitted =
    error.message.includes("omitted in production") || error.message.includes("Server Components render");
  return (
    <section className="rounded-lg border border-red-300 bg-white p-6">
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm">
        {omitted
          ? "The dashboard could not load live data. Confirm Vercel has DATA_DRIVER=supabase, SUPABASE_URL, and SUPABASE_SECRET_KEY, then redeploy."
          : error.message}
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-ink/50">Digest: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-pine px-3 py-2 text-sm text-white">
        Try again
      </button>
    </section>
  );
}
