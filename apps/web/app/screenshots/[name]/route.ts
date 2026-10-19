import { readFile } from "node:fs/promises";
import path from "node:path";
import { screenshotDirectory } from "@ct/db";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await context.params;
  const base = path.basename(name);
  if (base !== name || !base.endsWith(".png")) return new Response("Not found", { status: 404 });
  const file = path.join(screenshotDirectory(), base);
  try {
    const bytes = await readFile(file);
    return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
