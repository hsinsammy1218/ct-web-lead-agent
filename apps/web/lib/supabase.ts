import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            jar.set(cookie.name, cookie.value, cookie.options);
          }
        },
      },
    },
  );
}
