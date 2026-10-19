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
      <section className="rounded-lg border border-red-300 bg-white p-6">
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

  return (
    <section className="space-y-6">
      <AutoRefresh active={pipeline.active} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-pine">{lead.municipalityName}</p>
          <h1 className="font-serif text-3xl">{lead.displayName}</h1>
          <p className="mt-1 text-sm text-ink/70">
            {lead.industryName} · {lead.planningRegionName}
          </p>
        </div>
        <Link href="/leads" className="text-sm text-pine">
          Back to leads
        </Link>
      </div>

      {query.queued ? (
        <p className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          Work was queued. This page refreshes while the pipeline runs.
        </p>
      ) : null}
      {query.skipped ? (
        <p className="rounded-md border border-pine/30 bg-pine/5 px-3 py-2 text-sm">
          {query.reason
            ? decodeURIComponent(query.reason)
            : "This website or business was already on file. No new audit was queued."}
        </p>
      ) : null}

      <AuditProgress pipeline={pipeline} />

      {blocked ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-medium">Audit blocked</h2>
          <p className="mt-1 text-sm">{lead.audit?.summary ?? "The site refused the fetch. Quality and opportunity stay blank."}</p>
        </div>
      ) : null}
      {lead.audit?.status === "failed" ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <h2 className="font-medium">Audit failed</h2>
          <p className="mt-1 text-sm">{lead.audit.summary}</p>
        </div>
      ) : null}

      {scored ? (
        <article className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
            <div className="border-b border-line px-5 py-5 lg:border-b-0 lg:border-r">
              <p className="text-xs uppercase tracking-wide text-pine">Opportunity</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                <p className="font-serif text-5xl tabular-nums leading-none text-ink">
                  {lead.score?.opportunity ?? "—"}
                </p>
                <div className="pb-1">
                  <p className="rounded-md bg-pine/10 px-2.5 py-1 text-sm font-medium text-pine">
                    {bandLabel(lead.score?.band)}
                  </p>
                  <p className="mt-2 text-sm text-ink/70">
                    Recommended: {serviceLabel(lead.score?.recommendedService)}
                  </p>
                </div>
              </div>
              {lead.score?.explanation.notes.length ? (
                <ul className="mt-4 space-y-1.5 text-sm text-ink/75">
                  {lead.score.explanation.notes.slice(0, 4).map((note) => (
                    <li key={note} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pine" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 py-5">
              <ScoreMeter label="Quality" value={lead.score?.quality} muted={blocked} />
              <ScoreMeter label="Need" value={lead.score?.need} />
              <ScoreMeter label="Qualification" value={lead.score?.qualification} />
              <ScoreMeter label="Contact" value={lead.score?.contact} />
              <ScoreMeter label="Confidence" value={lead.score?.confidence} />
              <div className="rounded-md border border-line bg-paper/50 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-ink/50">Host</p>
                <p className="mt-2 font-serif text-xl">{hostLabel(lead.website.status)}</p>
              </div>
            </div>
          </div>
          {lead.score ? (
            <p className="border-t border-line px-5 py-3 text-xs text-ink/55">{lead.score.explanation.formula}</p>
          ) : null}
        </article>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <article className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-serif text-xl">Submitted details</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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

        <article className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-serif text-xl">Recommendation</h2>
          {lead.ai ? (
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <p className="text-base text-ink">{lead.ai.rationale}</p>
              <p>
                <span className="text-ink/50">Service · </span>
                {serviceLabel(lead.ai.recommended_service)}
                <span className="text-ink/50"> · Confidence {lead.ai.confidence}</span>
              </p>
              {lead.ai.unknowns.length ? (
                <p className="rounded-md bg-paper px-3 py-2 text-ink/75">
                  Still unknown: {lead.ai.unknowns.join("; ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/60">
              {pipeline.active
                ? "A written assessment appears after the audit collects enough evidence."
                : "No written assessment yet. Scores still come from measured evidence when available."}
            </p>
          )}
          {lead.audit?.summary ? <p className="mt-4 text-sm text-ink/75">{lead.audit.summary}</p> : null}
        </article>
      </div>

      {lead.audit?.screenshotPath ? (
        <article className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-serif text-xl">Homepage capture</h2>
          <img
            src={`/screenshots/${lead.audit.screenshotPath}`}
            alt={`Homepage of ${lead.displayName}`}
            className="mt-4 max-h-[28rem] w-full max-w-3xl rounded border border-line object-contain object-top"
          />
        </article>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
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

      <article className="rounded-lg border border-line bg-white p-5">
        <h2 className="font-serif text-xl">Generated website</h2>
        {lead.draft?.status === "ready" || lead.draft?.status === "publishing" || lead.draft?.deploymentUrl ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-base">{lead.draft.summary}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row
                label="Recommended service"
                value={serviceLabel(lead.draft.recommendedService ?? undefined)}
              />
              <Row
                label="Generated"
                value={lead.draft.generatedAt?.slice(0, 16).replace("T", " ") ?? "—"}
              />
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
          <p className="mt-4 text-sm text-ink/70">Draft website is queued. Progress updates above as the worker runs.</p>
        ) : lead.draft?.status === "failed" ? (
          <p className="mt-4 text-sm text-red-700">{lead.draft.error ?? "Website generation failed."}</p>
        ) : (
          <p className="mt-4 text-sm text-ink/60">
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
            className="rounded-md border border-line bg-white px-3 py-2 text-sm disabled:opacity-50"
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

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-serif text-xl">Status</h2>
          <form action={setLeadStatus} className="mt-4 flex flex-wrap items-end gap-2">
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
          <ul className="mt-4 space-y-1 text-sm text-ink/70">
            {lead.statusHistory.map((entry) => (
              <li key={`${entry.createdAt}-${entry.status}`}>
                {statusLabel(entry.status)} · {entry.createdAt.slice(0, 16).replace("T", " ")} · {entry.createdBy}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-serif text-xl">Notes</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {lead.notes.length === 0 ? <li className="text-ink/60">No notes yet.</li> : null}
            {lead.notes.map((note) => (
              <li key={note.id} className="rounded-md bg-paper px-3 py-2">
                <p>{note.body}</p>
                <p className="mt-1 text-xs text-ink/50">
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
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
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
      <dt className="text-xs uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="mt-0.5 break-all">{value}</dd>
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
    <article className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl">{title}</h2>
        <p className="text-xs uppercase tracking-wide text-ink/45">{findings.length}</p>
      </div>
      {findings.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {findings.map((finding) => (
            <li
              key={`${finding.code}-${finding.severity}`}
              className="flex items-start justify-between gap-3 rounded-md border border-line/80 bg-paper/40 px-3 py-2.5 text-sm"
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
  return <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>{severity}</span>;
}
