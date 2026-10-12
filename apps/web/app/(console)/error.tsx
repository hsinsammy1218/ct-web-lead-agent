"use client";

export default function ConsoleError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="rounded-lg border border-red-300 bg-white p-6">
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm">{error.message}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-pine px-3 py-2 text-sm text-white">
        Try again
      </button>
    </section>
  );
}
