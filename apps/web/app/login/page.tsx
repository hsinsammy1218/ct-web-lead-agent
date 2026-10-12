import { signIn } from "../actions";
import { SubmitButton } from "../../components/submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-wide text-pine">CT Web Lead Agent</p>
      <h1 className="mt-2 font-serif text-3xl">Operator sign in</h1>
      <p className="mt-3 text-sm text-ink/70">
        Only allowlisted emails can open the lead list. This tool does not search for websites.
      </p>
      {params.error === "not-allowed" ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm">That email is not on the operator list.</p>
      ) : null}
      {params.sent ? (
        <p className="mt-4 rounded-md border border-line bg-white px-3 py-2 text-sm">Check your email for the sign-in link.</p>
      ) : null}
      <form action={signIn} className="mt-6 space-y-3 rounded-lg border border-line bg-white p-5">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className="w-full rounded-md border border-line px-3 py-2" />
        <SubmitButton label="Continue" pendingLabel="Signing in…" />
      </form>
    </main>
  );
}
