import { scoreText } from "../lib/filters";

export function ScoreMeter({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number | null | undefined;
  muted?: boolean;
}) {
  const shown = value == null || muted ? null : Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-md border border-line bg-paper/50 px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-ink/50">{label}</p>
        <p className="font-serif text-xl tabular-nums">{shown == null ? "—" : scoreText(shown)}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-pine/80 transition-all duration-500"
          style={{ width: `${shown ?? 0}%` }}
        />
      </div>
    </div>
  );
}
