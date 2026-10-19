import { operatorEmails } from "./session";

export { COOKIE, operatorEmails, readOperatorCookie, signOperator } from "./session";

/** Attribution identity for notes/submissions. Sign-in is disabled. */
export async function currentOperator(): Promise<string> {
  return operatorEmails()[0] ?? "operator@local";
}
