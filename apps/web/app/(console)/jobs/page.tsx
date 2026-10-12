import { getStore } from "../../../lib/store";

export default async function JobsPage() {
  let jobs;
  let error: string | null = null;
  try {
    jobs = await getStore().listWork();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Jobs could not be loaded";
  }
  if (error || !jobs) {
    return (
      <section className="rounded-lg border border-red-300 bg-white p-6">
        <h1 className="font-serif text-2xl">Jobs are unavailable</h1>
        <p className="mt-2 text-sm">{error}</p>
      </section>
    );
  }
  return (
    <section>
      <h1 className="font-serif text-3xl">Jobs</h1>
      <p className="mt-2 text-sm text-ink/70">Audits start when a website is submitted. This list is the queue, not a discovery run.</p>
      {jobs.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-white p-6 text-sm">No jobs yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink/50">
              <tr>
                {["Type", "Status", "Attempt", "Run after", "Error"].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-line/80">
                  <td className="px-3 py-3">{job.jobType}</td>
                  <td className="px-3 py-3">{job.status}</td>
                  <td className="px-3 py-3">
                    {job.attempt}/{job.maxAttempts}
                  </td>
                  <td className="px-3 py-3">{job.runAfter.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-3">{job.lastError ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
