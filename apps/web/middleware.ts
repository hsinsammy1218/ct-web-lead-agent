import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readOperatorCookie } from "./lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return NextResponse.next();

  if (process.env.DATA_DRIVER === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value);
            response = NextResponse.next({ request });
            for (const cookie of cookiesToSet) response.cookies.set(cookie.name, cookie.value, cookie.options);
          },
        },
      },
    );
    // Magic-link callback must run before a session exists.
    if (pathname.startsWith("/auth/")) return response;

    const { data } = await supabase.auth.getUser();
    const signedIn = Boolean(data.user);
    if (!signedIn && pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (signedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  const operator = await readOperatorCookie(request.cookies.get("ct_operator")?.value);
  if (!operator && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (operator && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
