import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAD_STATUSES } from "@ct/core";
import { addNote, reaudit, regenerateDraft, rescore, setLeadStatus } from "../../../actions";
import { AuditProgress } from "../../../../components/audit-progress";
import { AutoRefresh } from "../../../../components/auto-refresh";
import { ScoreMeter } from "../../../../components/score-meter";
import { SubmitButton } from "../../../../components/submit-button";
import { bandLabel, hostLabel, serviceLabel, statusLabel } from "../../../../lib/labels";
import { buildLeadPipeline } from "../../../../lib/pipeline";
import { getStore } from "../../../../lib/store";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  let store;
  try {
    store = getStore();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Lead store unavailable";
    return (
      <section className="surface-quiet p-6">
        <h1 className="font-serif text-2xl">Lead is unavailable</h1>
        <p className="mt-2 text-sm">{message}</p>
      </section>
    );
  }
  const lead = await store.getLead(id);
  if (!lead) notFound();
  const [budget, work] = await Promise.all([store.budgetDecision(0.004), store.listWork()]);
  const pipeline = buildLeadPipeline(lead, work);
  const measured = lead.audit?.findings.filter((finding) => finding.source === "measured") ?? [];
  const inferred = lead.audit?.findings.filter((finding) => finding.source === "inferred") ?? [];
  const blocked = lead.audit?.status === "blocked" || lead.website.status === "BLOCKED";
  const scored = Boolean(lead.score);
  const siteHost = (() => {
    try {
      return new URL(lead.website.originalUrl).hostname.replace(/^www\./, "");
    } catch {
      return lead.website.registrableDomain;
    }
  })();

  return (
    <section className="space-y-7">
      <AutoRefresh active={pipeline.active} />

      <div className="lead-hero px-6 py-7 sm:px-8">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/65">{lead.municipalityName}</p>
            <h1 className="mt-2 max-w-3xl font-serif text-4xl tracking-tight sm:text-5xl">{lead.displayName}</h1>
            <p className="mt-3 text-sm text-white/75">
              {lead.industryName} · {lead.planningRegionName}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/12 px-3 py-1.5 backdrop-blur-sm">{hostLabel(lead.website.status)}</span>
              <span className="rounded-full bg-white/12 px-3 py-1.5 backdrop-blur-sm">{statusLabel(lead.leadStatus)}</span>
              <a
                href={lead.website.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/12 px-3 py-1.5 backdrop-blur-sm transition hover:bg-white/20"
              >
                {siteHost} ↗
              </a>
            </div>
          </div>
          <Link href="/leads" className="text-sm text-white/75 transition hover:text-white">
            ← Back to leads
          </Link>
        </div>
      </div>

      {query.queued ? (
        <p className="surface-quiet px-4 py-3 text-sm">Work was queued. This page keeps pace while the pipeline runs.</p>
      ) : null}
      {query.skipped ? (
        <p className="surface-quiet border-pine/25 bg-pine/5 px-4 py-3 text-sm">
          {query.reason
            ? decodeURIComponent(query.reason)
            : "This website or business was already on file. No new audit was queued."}
        </p>
      ) : null}

      <AuditProgress pipeline={pipeline} />

      {pipeline.active && !scored ? (
        <article className="lead-panel relative overflow-hidden px-6 py-7 sm:px-8">
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-pine/10">
            <div className="waiting-scan h-full w-1/3 bg-gradient-to-r from-transparent via-pine to-transparent" />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-pine">Agent at work</p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight">Watching the site come into focus</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
            We’re fetching the public pages, measuring what visitors feel, then turning that into opportunity scores and
            a recommended pitch. Sit tight — this view refreshes on its own.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Fetch", "Public HTML and redirects"],
              ["02", "Measure", "Speed, mobile, SEO, UX signals"],
              ["03", "Decide", "Score, notes, draft site next"],
            ].map(([num, title, copy]) => (
              <div key={num} className="rounded-xl border border-line/70 bg-white/60 px-4 py-4">
                <p className="font-serif text-2xl text-pine/80">{num}</p>
                <p className="mt-1 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-ink/55">{copy}</p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {blocked ? (
        <div className="surface-quiet border-amber-300/80 bg-amber-50/90 p-5">
          <h2 className="font-medium">Audit blocked</h2>
          <p className="mt-1 text-sm">{lead.audit?.summary ?? "The site refused the fetch. Quality and opportunity stay blank."}</p>
        </div>
      ) : null}
      {lead.audit?.status === "failed" ? (
        <div className="surface-quiet border-red-300/80 bg-red-50/90 p-5">
          <h2 className="font-medium">Audit failed</h2>
          <p className="mt-1 text-sm">{lead.audit.summary}</p>
        </div>
      ) : null}

      {scored ? (
        <article className="lead-panel overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
            <div className="border-b border-line/80 px-6 py-7 lg:border-b-0 lg:border-r sm:px-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-pine">Opportunity</p>
              <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
                <p className="font-serif text-6xl tabular-nums leading-none tracking-tight text-ink">
                  {lead.score?.opportunity ?? "—"}
                </p>
                <div className="pb-1">
                  <p className="inline-flex rounded-full bg-pine/10 px-3 py-1 text-sm font-medium text-pine">
                    {bandLabel(lead.score?.band)}
                  </p>
                  <p className="mt-2 text-sm text-ink/65">
                    Recommended: {serviceLabel(lead.score?.recommendedService)}
                  </p>
                </div>
              </div>
              {lead.score?.explanation.notes.length ? (
                <ul className="mt-5 space-y-2 text-sm text-ink/75">
                  {lead.score.explanation.notes.slice(0, 4).map((note) => (
                    <li key={note} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pine" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 px-6 py-7 sm:px-8">
              <ScoreMeter label="Quality" value={lead.score?.quality} muted={blocked} />
              <ScoreMeter label="Need" value={lead.score?.need} />
              <ScoreMeter label="Qualification" value={lead.score?.qualification} />
              <ScoreMeter label="Contact" value={lead.score?.contact} />
              <ScoreMeter label="Confidence" value={lead.score?.confidence} />
              <div className="rounded-xl border border-line/80 bg-white/70 px-3.5 py-3.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Host</p>
                <p className="mt-2 font-serif text-2xl tracking-tight">{hostLabel(lead.website.status)}</p>
              </div>
            </div>
          </div>
          {lead.score ? (
            <p className="border-t border-line/80 px-6 py-3 text-xs text-ink/50 sm:px-8">{lead.score.explanation.formula}</p>
          ) : null}
        </article>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="surface-quiet p-6">
          <h2 className="font-serif text-2xl tracking-tight">Submitted details</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <Row label="Website" value={lead.website.originalUrl} />
            <Row label="Final URL" value={lead.website.finalUrl ?? "Not fetched yet"} />
            <Row label="Host" value={hostLabel(lead.website.status)} />
            <Row label="Submitted" value={lead.createdAt.slice(0, 16).replace("T", " ")} />
            <Row label="Submitted by" value={lead.submittedBy} />
            <Row label="Phone" value={lead.phone ?? "None on file"} />
            {lead.website.nameMentionWarning ? (
              <Row label="Name check" value="The page may not mention this business." />
            ) : null}
          </dl>
        </article>

        <article className="surface-quiet p-6">
          <h2 className="font-serif text-2xl tracking-tight">Recommendation</h2>
          {lead.ai ? (
            <div className="mt-5 space-y-3 text-sm leading-relaxed">
              <p className="text-base text-ink">{lead.ai.rationale}</p>
              <p>
                <span className="text-ink/45">Service · </span>
                {serviceLabel(lead.ai.recommended_service)}
                <span className="text-ink/45"> · Confidence {lead.ai.confidence}</span>
              </p>
              {lead.ai.unknowns.length ? (
                <p className="rounded-xl bg-paper/80 px-3 py-2 text-ink/75">
                  Still unknown: {lead.ai.unknowns.join("; ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-ink/60">
              {pipeline.active
                ? "A written assessment lands here once the audit collects enough evidence."
                : "No written assessment yet. Scores still come from measured evidence when available."}
            </p>
          )}
          {lead.audit?.summary ? <p className="mt-4 text-sm text-ink/70">{lead.audit.summary}</p> : null}
        </article>
      </div>

      {lead.audit?.screenshotPath ? (
        <article className="surface-quiet p-6">
          <h2 className="font-serif text-2xl tracking-tight">Homepage capture</h2>
          <img
            src={`/screenshots/${lead.audit.screenshotPath}`}
            alt={`Homepage of ${lead.displayName}`}
            className="mt-5 max-h-[28rem] w-full max-w-3xl rounded-xl border border-line object-contain object-top"
          />
        </article>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <FindingList
          title="Measured findings"
          findings={measured}
          empty={pipeline.active ? "Findings appear as the audit finishes." : "No measured findings yet."}
        />
        <FindingList
          title="Inferred findings"
          findings={inferred}
          empty={pipeline.active ? "Inferences appear after measurement." : "No inferences stored."}
        />
      </div>

      <article className="surface-quiet p-6">
        <h2 className="font-serif text-2xl tracking-tight">Generated website</h2>
        {lead.draft?.status === "ready" || lead.draft?.status === "publishing" || lead.draft?.deploymentUrl ? (
          <div className="mt-5 space-y-3 text-sm">
            <p className="text-base">{lead.draft.summary}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Recommended service" value={serviceLabel(lead.draft.recommendedService ?? undefined)} />
              <Row label="Generated" value={lead.draft.generatedAt?.slice(0, 16).replace("T", " ") ?? "—"} />
              {lead.draft.publishStatus ? <Row label="Publish status" value={lead.draft.publishStatus} /> : null}
              {lead.draft.testsPassed != null ? (
                <Row label="Production checks" value={lead.draft.testsPassed ? "Passed" : "Failed"} />
              ) : null}
            </div>
            {lead.draft.repoUrl ? (
              <p>
                GitHub:{" "}
                <a className="text-pine" href={lead.draft.repoUrl} target="_blank" rel="noreferrer">
                  {lead.draft.githubRepo ?? lead.draft.repoUrl}
                </a>
              </p>
            ) : null}
            {lead.draft.deploymentUrl ? (
              <p>
                Live site:{" "}
                <a className="text-pine" href={lead.draft.deploymentUrl} target="_blank" rel="noreferrer">
                  {lead.draft.deploymentUrl}
                </a>
              </p>
            ) : null}
            {lead.draft.testChecks?.length ? (
              <ul className="space-y-1">
                {lead.draft.testChecks.map((check) => (
                  <li key={check.name} className="flex gap-2">
                    <span className={check.ok ? "text-pine" : "text-red-700"}>{check.ok ? "✓" : "✗"}</span>
                    <span>
                      {check.name} — {check.detail}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {lead.draft.fixesApplied.length ? (
              <ul className="list-disc space-y-1 pl-5 text-ink/80">
                {lead.draft.fixesApplied.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {lead.draft.previewPath ? (
                <a
                  href={lead.draft.previewPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-md bg-pine px-3 py-2 text-white"
                >
                  Open local preview
                </a>
              ) : null}
              {lead.draft.deploymentUrl ? (
                <a
                  href={lead.draft.deploymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-md border border-line bg-white px-3 py-2"
                >
                  Open live site
                </a>
              ) : null}
            </div>
            {lead.draft.error ? <p className="text-amber-800">{lead.draft.error}</p> : null}
          </div>
        ) : lead.draft?.status === "queued" ? (
          <p className="mt-5 text-sm text-ink/65">Draft website is queued. Progress updates above as the worker runs.</p>
        ) : lead.draft?.status === "failed" ? (
          <p className="mt-5 text-sm text-red-700">{lead.draft.error ?? "Website generation failed."}</p>
        ) : (
          <p className="mt-5 text-sm leading-relaxed text-ink/60">
            After scoring, the worker builds the site, creates a GitHub repo, deploys to Vercel, and runs production
            checks.
          </p>
        )}
      </article>

      <div className="flex flex-wrap gap-3">
        <form action={reaudit}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <button
            type="submit"
            disabled={!budget.ok}
            className="rounded-full border border-line bg-white/80 px-4 py-2.5 text-sm transition hover:border-pine/40 disabled:opacity-50"
          >
            Re-audit
          </button>
        </form>
        <form action={rescore}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <SubmitButton label="Rescore" pendingLabel="Queuing…" />
        </form>
        <form action={regenerateDraft}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <SubmitButton label="Regenerate website" pendingLabel="Queuing…" />
        </form>
        <form action={setLeadStatus} className="flex items-center gap-2">
          <input type="hidden" name="lead_id" value={lead.id} />
          <input type="hidden" name="status" value="contacted" />
          <SubmitButton label="Mark contacted" pendingLabel="Saving…" />
        </form>
        {!budget.ok ? (
          <p className="self-center text-sm text-amber-800">{budget.reason}. Re-audit stays off until the cap resets.</p>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="surface-quiet p-6">
          <h2 className="font-serif text-2xl tracking-tight">Status</h2>
          <form action={setLeadStatus} className="mt-5 flex flex-wrap items-end gap-2">
            <input type="hidden" name="lead_id" value={lead.id} />
            <label className="text-sm">
              Lead status
              <select name="status" defaultValue={lead.leadStatus} className="mt-1 block rounded-md border border-line px-2 py-2">
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton label="Update status" pendingLabel="Saving…" />
          </form>
          <ul className="mt-4 space-y-1 text-sm text-ink/65">
            {lead.statusHistory.map((entry) => (
              <li key={`${entry.createdAt}-${entry.status}`}>
                {statusLabel(entry.status)} · {entry.createdAt.slice(0, 16).replace("T", " ")} · {entry.createdBy}
              </li>
            ))}
          </ul>
        </article>

        <article className="surface-quiet p-6">
          <h2 className="font-serif text-2xl tracking-tight">Notes</h2>
          <ul className="mt-5 space-y-2 text-sm">
            {lead.notes.length === 0 ? <li className="text-ink/55">No notes yet.</li> : null}
            {lead.notes.map((note) => (
              <li key={note.id} className="rounded-xl bg-paper/80 px-3 py-2">
                <p>{note.body}</p>
                <p className="mt-1 text-xs text-ink/45">
                  {note.createdBy} · {note.createdAt.slice(0, 16).replace("T", " ")}
                </p>
              </li>
            ))}
          </ul>
          <form action={addNote} className="mt-4 space-y-2">
            <input type="hidden" name="lead_id" value={lead.id} />
            <textarea
              name="body"
              required
              rows={3}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="What you observed"
            />
            <SubmitButton label="Add note" pendingLabel="Saving…" />
          </form>
        </article>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-ink/45">{label}</dt>
      <dd className="mt-1 break-all">{value}</dd>
    </div>
  );
}

function FindingList({
  title,
  findings,
  empty,
}: {
  title: string;
  findings: Array<{ code: string; severity: string; source: string }>;
  empty: string;
}) {
  return (
    <article className="surface-quiet p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/40">{findings.length}</p>
      </div>
      {findings.length === 0 ? (
        <p className="mt-5 text-sm text-ink/55">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {findings.map((finding) => (
            <li
              key={`${finding.code}-${finding.severity}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-line/70 bg-white/60 px-3 py-2.5 text-sm"
            >
              <span className="capitalize">{finding.code.replaceAll("_", " ")}</span>
              <SeverityBadge severity={finding.severity} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "critical"
      ? "bg-red-100 text-red-800"
      : severity === "moderate"
        ? "bg-amber-100 text-amber-900"
        : "bg-pine/10 text-pine";
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tone}`}>{severity}</span>;
}
