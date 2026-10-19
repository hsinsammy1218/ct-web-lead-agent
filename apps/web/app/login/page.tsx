import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Sign-in removed — send anyone hitting /login to the console. */
export default function LoginPage() {
  redirect("/");
}
