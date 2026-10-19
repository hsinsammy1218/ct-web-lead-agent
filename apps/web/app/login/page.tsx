import { redirect } from "next/navigation";

/** Sign-in removed — send anyone hitting /login to the console. */
export default function LoginPage() {
  redirect("/");
}
