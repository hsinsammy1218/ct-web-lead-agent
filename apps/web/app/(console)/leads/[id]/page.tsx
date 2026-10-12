import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAD_STATUSES } from "@ct/core";
import { addNote, reaudit, rescore, setLeadStatus } from "../../../actions";
import { SubmitButton } from "../../../../components/submit-button";
import { bandLabel, hostLabel, serviceLabel, statusLabel } from "../../../../lib/labels";
import { scoreText } from "../../../../lib/filters";
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
  const store = getStore();
  const lead = await store.getLead(id);
  if (!lead) notFound();
  const budget = await store.budgetDecision(0.004);
  const measured = lead.audit?.findings.filter((finding) => finding.source === "measured") ?? [];
  const inferred = lead.audit?.findings.filter((finding) => finding.source === "inferred") ?? [];
  const blocked = lead.audit?.status === "blocked" || lead.website.status === "BLOCKED";
  const pending = lead.audit?.status === "queued" || !lead.score;
  return (
    <section className="space-y-6">
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
      {query.queued ? <p className="rounded-md border border-line bg-white px-3 py-2 text-sm">Work was queued. Refresh after the worker finishes.</p> : null}
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
      {pending && lead.audit?.status === "queued" ? (
        <div className="rounded-lg border border-dashed border-line bg-white p-4 text-sm">The audit is queued. Scores stay blank until it finishes.</div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl">Submitted details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Website" value={lead.website.originalUrl} />
            <Row label="Final URL" value={lead.website.finalUrl ?? "Not fetched yet"} />
            <Row label="Host" value={hostLabel(lead.website.status)} />
            <Row label="Submitted by" value={lead.submittedBy} />
            <Row label="Submitted" value={lead.createdAt.slice(0, 16).replace("T", " ")} />
            {lead.website.nameMentionWarning ? <Row label="Name check" value="The page may not mention this business." /> : null}
          </dl>
          <h3 className="mt-4 text-sm font-medium">Contacts</h3>
          {lead.phone ? (
            <p className="mt-1 text-sm">
              {lead.phone} <span className="text-ink/50">operator</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/60">No operator phone.</p>
          )}
        </article>
        <article className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl">Scores</h2>
          {lead.score ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Row label="Quality" value={blocked ? "—" : scoreText(lead.score.quality)} />
              <Row label="Need" value={scoreText(lead.score.need)} />
              <Row label="Qualification" value={scoreText(lead.score.qualification)} />
              <Row label="Contact" value={scoreText(lead.score.contact)} />
              <Row label="Confidence" value={scoreText(lead.score.confidence)} />
              <Row label="Opportunity" value={scoreText(lead.score.opportunity)} />
              <Row label="Band" value={bandLabel(lead.score.band)} />
              <Row label="Service" value={serviceLabel(lead.score.recommendedService)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink/60">No score yet.</p>
          )}
          {lead.score ? <p className="mt-3 text-xs text-ink/60">{lead.score.explanation.formula}</p> : null}
          {lead.score?.explanation.notes.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {lead.score.explanation.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>
      {lead.audit?.screenshotPath ? (
        <article className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl">Screenshot</h2>
          <img src={`/screenshots/${lead.audit.screenshotPath}`} alt={`Homepage of ${lead.displayName}`} className="mt-3 max-w-sm rounded border border-line" />
        </article>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <FindingList title="Measured findings" findings={measured} empty="No measured findings yet." />
        <FindingList title="Inferred findings" findings={inferred} empty="No inferences stored." />
      </div>
      <article className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-serif text-xl">Recommendation</h2>
        {lead.ai ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>{lead.ai.rationale}</p>
            <p>Service: {serviceLabel(lead.ai.recommended_service)}</p>
            {lead.ai.unknowns.length ? <p>Unknown: {lead.ai.unknowns.join("; ")}</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/60">No written assessment. Scores still come from the measured evidence.</p>
        )}
        {lead.audit?.summary ? <p className="mt-3 text-sm">{lead.audit.summary}</p> : null}
      </article>
      <div className="flex flex-wrap gap-3">
        <form action={reaudit}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <button type="submit" disabled={!budget.ok} className="rounded-md border border-line bg-white px-3 py-2 text-sm disabled:opacity-50">
            Re-audit
          </button>
        </form>
        <form action={rescore}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <SubmitButton label="Rescore" pendingLabel="Queuing…" />
        </form>
        <form action={setLeadStatus} className="flex items-center gap-2">
          <input type="hidden" name="lead_id" value={lead.id} />
          <input type="hidden" name="status" value="contacted" />
          <SubmitButton label="Mark contacted" pendingLabel="Saving…" />
        </form>
        {!budget.ok ? <p className="self-center text-sm text-amber-800">{budget.reason}. Re-audit stays off until the cap resets.</p> : null}
      </div>
      <article className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-serif text-xl">Status</h2>
        <form action={setLeadStatus} className="mt-3 flex flex-wrap items-end gap-2">
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
        <ul className="mt-3 space-y-1 text-sm text-ink/70">
          {lead.statusHistory.map((entry) => (
            <li key={`${entry.createdAt}-${entry.status}`}>
              {statusLabel(entry.status)} · {entry.createdAt.slice(0, 16).replace("T", " ")} · {entry.createdBy}
            </li>
          ))}
        </ul>
      </article>
      <article className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-serif text-xl">Notes</h2>
        <ul className="mt-3 space-y-2 text-sm">
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
        <form action={addNote} className="mt-3 space-y-2">
          <input type="hidden" name="lead_id" value={lead.id} />
          <textarea name="body" required rows={3} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="What you observed" />
          <SubmitButton label="Add note" pendingLabel="Saving…" />
        </form>
      </article>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="break-all">{value}</dd>
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
    <article className="rounded-lg border border-line bg-white p-4">
      <h2 className="font-serif text-xl">{title}</h2>
      {findings.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {findings.map((finding) => (
            <li key={`${finding.code}-${finding.severity}`}>
              {finding.code.replaceAll("_", " ")} · {finding.severity}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
