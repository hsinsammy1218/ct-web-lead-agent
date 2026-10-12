import { cookies } from "next/headers";
import { COOKIE, operatorEmails, readOperatorCookie, signOperator } from "./session";

export { COOKIE, operatorEmails, readOperatorCookie, signOperator };

export async function currentOperator(): Promise<string | null> {
  if (process.env.DATA_DRIVER === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import("./supabase");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase();
    if (!email || !operatorEmails().includes(email)) return null;
    const role = data.user?.app_metadata?.role;
    if (role !== "operator" && process.env.SUPABASE_SECRET_KEY && data.user) {
      const { createClient: createAdmin } = await import("@supabase/supabase-js");
      const admin = createAdmin(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false },
      });
      await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { role: "operator" } });
    }
    return email;
  }
  const jar = await cookies();
  return readOperatorCookie(jar.get(COOKIE)?.value);
}
