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
    <div className="rounded-xl border border-line/80 bg-white/70 px-3.5 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">{label}</p>
        <p className="font-serif text-2xl tabular-nums tracking-tight">{shown == null ? "—" : scoreText(shown)}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pine to-moss transition-all duration-700"
          style={{ width: `${shown ?? 0}%` }}
        />
      </div>
    </div>
  );
}
