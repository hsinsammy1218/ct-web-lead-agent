const COOKIE = "ct_operator";

export function operatorEmails(): string[] {
  return (process.env.OPERATOR_EMAILS ?? "operator@example.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function secret(): string {
  return process.env.DEV_AUTH_SECRET ?? "dev-only";
}

export async function signOperator(email: string): Promise<string> {
  return `${email}.${await hmacHex(email)}`;
}

export async function readOperatorCookie(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const split = value.lastIndexOf(".");
  if (split < 0) return null;
  const email = value.slice(0, split);
  const expected = await signOperator(email);
  if (!constantTimeEqual(value, expected)) return null;
  if (!operatorEmails().includes(email)) return null;
  return email;
}

async function hmacHex(email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export { COOKIE };
