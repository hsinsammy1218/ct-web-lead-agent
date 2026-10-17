import { readFile } from "node:fs/promises";
import path from "node:path";
import { draftSiteDirectory } from "@ct/db";
import { currentOperator } from "../../../lib/auth";
import { getStore } from "../../../lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await currentOperator())) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const lead = await getStore().getLead(id);
  if (!lead?.draft || lead.draft.status !== "ready") {
    return new Response("Draft not ready yet. Run the worker, then refresh.", { status: 404 });
  }
  const file = path.join(draftSiteDirectory(), id, "index.html");
  try {
    const html = await readFile(file, "utf8");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch {
    return new Response("Draft file missing", { status: 404 });
  }
}
