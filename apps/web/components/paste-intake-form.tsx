"use client";

import { useState, useTransition } from "react";
import { interpretPaste, submitWebsite } from "../app/actions";
import { SubmitButton } from "./submit-button";

type Option = { value: string; label: string };

type Draft = {
  businessName: string;
  municipality: string;
  industry: string;
  websiteUrl: string;
  phone: string;
  note: string;
};

const EMPTY: Draft = {
  businessName: "",
  municipality: "",
  industry: "",
  websiteUrl: "",
  phone: "",
  note: "",
};

export function PasteIntakeForm({
  municipalities,
  industries,
  error,
  duplicate,
}: {
  municipalities: Option[];
  industries: Option[];
  error?: string;
  duplicate?: string;
}) {
  const [paste, setPaste] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [agentNote, setAgentNote] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fillWithAgent() {
    setAgentError(null);
    startTransition(async () => {
      const result = await interpretPaste(paste);
      if (!result.ok) {
        setAgentError(result.message);
        return;
      }
      setDraft(result.draft);
      setAgentNote(result.message);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-white p-5">
        <label className="block text-sm font-medium" htmlFor="paste-intake">
          Paste a website URL or business details
        </label>
        <p className="mt-1 text-sm text-ink/70">
          Drop in a link, a name and town, or a short blurb. The agent fills the fields below for you to review.
        </p>
        <textarea
          id="paste-intake"
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          rows={5}
          placeholder={"Harbor Boxing\nHartford boxing gym\nhttps://example.com\n(860) 555-0100"}
          className="mt-3 w-full rounded-md border border-line px-3 py-2 font-normal"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fillWithAgent}
            disabled={pending || !paste.trim()}
            className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Filling…" : "Fill with agent"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setAgentNote(null);
              setAgentError(null);
            }}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm"
          >
            Clear fields
          </button>
        </div>
        {agentError ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm">{agentError}</p>
        ) : null}
        {agentNote ? (
          <p className="mt-3 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink/80">{agentNote}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm">{error}</p>
      ) : null}

      <form action={submitWebsite} className="space-y-4 rounded-lg border border-line bg-white p-5">
        <p className="text-sm font-medium">Review and queue</p>
        <Field
          label="Business name"
          name="business_name"
          required
          value={draft.businessName}
          onChange={(value) => setDraft((current) => ({ ...current, businessName: value }))}
        />
        <label className="block text-sm font-medium">
          Municipality
          <select
            name="municipality"
            required
            value={draft.municipality}
            onChange={(event) => setDraft((current) => ({ ...current, municipality: event.target.value }))}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
          >
            <option value="">Choose a Connecticut town</option>
            {municipalities.map((municipality) => (
              <option key={municipality.value} value={municipality.value}>
                {municipality.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Industry
          <select
            name="industry"
            required
            value={draft.industry}
            onChange={(event) => setDraft((current) => ({ ...current, industry: event.target.value }))}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
          >
            <option value="">Choose an industry</option>
            {industries.map((industry) => (
              <option key={industry.value} value={industry.value}>
                {industry.label}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Website URL"
          name="website_url"
          type="url"
          required
          placeholder="https://"
          value={draft.websiteUrl}
          onChange={(value) => setDraft((current) => ({ ...current, websiteUrl: value }))}
        />
        <Field
          label="Phone (optional)"
          name="phone"
          value={draft.phone}
          onChange={(value) => setDraft((current) => ({ ...current, phone: value }))}
        />
        <label className="block text-sm font-medium">
          Note (optional)
          <textarea
            name="note"
            rows={3}
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
          />
        </label>
        {duplicate ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="allow_duplicate" className="mt-1" />
            Force create only if this is a different business on a domain already on file (not already audited).
          </label>
        ) : null}
        <SubmitButton label="Queue audit" pendingLabel="Saving…" />
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
      />
    </label>
  );
}
