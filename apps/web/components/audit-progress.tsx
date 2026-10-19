import type { LeadPipeline, PipelineStepStatus } from "../lib/pipeline";

const STEP_HINT: Record<string, string> = {
  submitted: "In",
  audit: "Scan",
  assess: "Read",
  score: "Rank",
  generate: "Build",
  publish: "Ship",
};

export function AuditProgress({ pipeline }: { pipeline: LeadPipeline }) {
  const activeIndex = pipeline.steps.findIndex((step) => step.status === "active");
  return (
    <article className="lead-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-pine/15 blur-3xl ambient-drift" />
        <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-moss/20 blur-3xl ambient-drift-slow" />
        <div className="absolute inset-0 lead-grid opacity-[0.35]" />
      </div>

      <div className="relative border-b border-white/10 px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-pine/80">Live pipeline</p>
              {pipeline.active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pine/10 px-2.5 py-1 text-[11px] font-medium text-pine">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-pine/50" />
                    <span className="relative h-2 w-2 rounded-full bg-pine" />
                  </span>
                  Working now
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink sm:text-4xl">{pipeline.headline}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/65">{pipeline.subline}</p>
          </div>
          <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(15,110,86,0.12)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#0f6e56"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(pipeline.percent, pipeline.active ? 6 : 0) * 2.64} 264`}
                className={pipeline.active ? "progress-draw" : ""}
              />
            </svg>
            <div className="text-center">
              <p className="font-serif text-3xl tabular-nums leading-none text-pine">{pipeline.percent}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink/45">pct</p>
            </div>
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
          <div
            className={`relative h-full rounded-full bg-gradient-to-r from-pine via-moss to-pine ${pipeline.active ? "progress-shimmer" : ""}`}
            style={{ width: `${Math.max(pipeline.percent, pipeline.active ? 10 : 0)}%` }}
          />
        </div>
      </div>

      <ol className="relative grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {pipeline.steps.map((step, index) => {
          const isActive = step.status === "active";
          const isDone = step.status === "done";
          return (
            <li
              key={step.id}
              className={`relative border-t border-white/10 px-4 py-5 sm:border-l sm:border-t-0 xl:border-l first:sm:border-l-0 ${
                isActive ? "bg-pine/[0.07]" : isDone ? "bg-white/40" : "bg-transparent"
              }`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {index < pipeline.steps.length - 1 ? (
                <span
                  className={`pointer-events-none absolute right-0 top-8 hidden h-px w-full translate-x-1/2 xl:block ${
                    index < activeIndex || isDone ? "bg-pine/40" : "bg-ink/10"
                  }`}
                  aria-hidden
                />
              ) : null}
              <div className={`step-rise ${isActive ? "step-active" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <StepMark status={step.status} index={index + 1} />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-ink/40">
                      {STEP_HINT[step.id] ?? "Step"}
                    </p>
                    <p className="text-sm font-semibold text-ink">{step.label}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink/60">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function StepMark({ status, index }: { status: PipelineStepStatus; index: number }) {
  if (status === "done") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine text-sm font-semibold text-white shadow-[0_0_0_4px_rgba(15,110,86,0.12)]">
        ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-700 text-sm font-semibold text-white">
        !
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-sm text-ink/45">
        –
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">
        <span className="absolute -inset-1 animate-ping rounded-full bg-pine/25" />
        <span className="relative">{index}</span>
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-sm text-ink/35">
      {index}
    </span>
  );
}
