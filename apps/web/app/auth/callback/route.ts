import { NextResponse, type NextRequest } from "next/server";

/** Auth callbacks are unused — console is open without sign-in. */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.nextUrl.origin));
}
