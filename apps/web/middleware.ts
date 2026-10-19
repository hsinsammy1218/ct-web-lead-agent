import { NextResponse, type NextRequest } from "next/server";

/** Open console — no operator sign-in gate. */
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
