import type { LeadPipeline, PipelineStepStatus } from "../lib/pipeline";

export function AuditProgress({ pipeline }: { pipeline: LeadPipeline }) {
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-pine">Audit progress</p>
          <h2 className="font-serif text-2xl">{pipeline.headline}</h2>
          <p className="mt-1 text-sm text-ink/70">{pipeline.subline}</p>
        </div>
        <div className="min-w-[8rem] text-right">
          <p className="font-serif text-3xl tabular-nums text-pine">{pipeline.percent}%</p>
          <p className="text-xs uppercase tracking-wide text-ink/50">complete</p>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-paper">
          <div
            className={`h-full rounded-full bg-pine transition-all duration-700 ${pipeline.active ? "progress-pulse" : ""}`}
            style={{ width: `${Math.max(pipeline.percent, pipeline.active ? 8 : 0)}%` }}
          />
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {pipeline.steps.map((step, index) => (
            <li key={step.id} className="relative">
              <div
                className={`rounded-md border px-3 py-3 ${toneClass(step.status)} ${
                  step.status === "active" ? "ring-1 ring-pine/30" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <StepMark status={step.status} index={index + 1} />
                  <p className="text-sm font-medium">{step.label}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink/65">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

function StepMark({ status, index }: { status: PipelineStepStatus; index: number }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pine text-[11px] font-semibold text-white">
        ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-700 text-[11px] font-semibold text-white">
        !
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-[11px] text-ink/50">
        –
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-pine text-[11px] font-semibold text-pine">
        <span className="absolute inset-0 animate-ping rounded-full bg-pine/20" />
        <span className="relative">{index}</span>
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-[11px] text-ink/40">
      {index}
    </span>
  );
}

function toneClass(status: PipelineStepStatus): string {
  switch (status) {
    case "done":
      return "border-pine/25 bg-pine/[0.04]";
    case "active":
      return "border-pine/40 bg-white";
    case "failed":
      return "border-red-300 bg-red-50";
    case "skipped":
      return "border-line bg-paper/60";
    default:
      return "border-line bg-paper/40";
  }
}
