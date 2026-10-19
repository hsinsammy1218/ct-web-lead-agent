"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-pine px-4 py-2.5 text-sm font-medium text-white transition hover:bg-deep disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
