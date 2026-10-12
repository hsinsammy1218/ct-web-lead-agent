import { currentOperator } from "../../lib/auth";
import { filtersFromParams } from "../../lib/filters";
import { getStore } from "../../lib/store";

export async function GET(request: Request): Promise<Response> {
  if (!(await currentOperator())) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const csv = await getStore().exportCsv(filtersFromParams(params));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=ct-leads.csv",
    },
  });
}
