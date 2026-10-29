"use server";

// Account actions (T6). Each one applies the per-connection limit before anything else, then calls Better Auth on
// the server; the session cookie is set by Better Auth's nextCookies plugin. Forms work without JavaScript.
import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS, LIMITS } from "@/config/shop";
import { getDb } from "@/db/client";
import { friendlyAuthError, readSignIn, readSignUp } from "@/lib/account-forms";
import { clientAddress, consume, limitKey } from "@/lib/rate-limit";
import { getAuth } from "./server";
import { getCurrentUser } from "./session";

export interface FormState {
  message?: string;
  errors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
}

const HOUR = 60 * 60;

/** Counts one attempt for this connection, or for one email address when `subject` is given. */
async function allowed(action: "sign-up" | "sign-in" | "sign-in-email", max: number, subject?: string): Promise<boolean> {
  const who = subject ?? clientAddress(await headers());
  const result = await consume(getDb() as never, limitKey(action, who), { max, windowSeconds: HOUR });
  return result.allowed;
}

const codeOf = (e: unknown) => (e instanceof APIError ? (e.body as { code?: string } | undefined)?.code : undefined);
const TOO_MANY = "Too many attempts from this connection. Please wait an hour and try again.";

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const read = readSignUp(form);
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!read.ok) return { errors: read.errors, values };
  if (!(await allowed("sign-up", LIMITS.signUpsPerHourPerConnection))) return { message: TOO_MANY, values };
  try {
    await getAuth().api.signUpEmail({ body: read.value, headers: await headers() });
  } catch (e) {
    return { message: friendlyAuthError(codeOf(e)), values };
  }
  redirect("/account");
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const read = readSignIn(form);
  const values = { email: String(form.get("email") ?? "") };
  if (!read.ok) return { errors: read.errors, values };
  if (!(await allowed("sign-in", LIMITS.signInsPerHourPerConnection))) return { message: TOO_MANY, values };
  // Guessing at one account from many connections is limited too (the key is a salted hash, not the address).
  if (!(await allowed("sign-in-email", LIMITS.signInsPerHourPerEmail, read.value.email.trim().toLowerCase()))) {
    return { message: "Too many attempts for this account. Please wait an hour and try again.", values };
  }
  try {
    await getAuth().api.signInEmail({ body: read.value, headers: await headers() });
  } catch (e) {
    return { message: friendlyAuthError(codeOf(e)), values };
  }
  redirect("/account");
}

async function demoSignIn(kind: keyof typeof DEMO_ACCOUNTS, to: string): Promise<FormState> {
  if (!(await allowed("sign-in", LIMITS.signInsPerHourPerConnection))) return { message: TOO_MANY };
  const { email, password } = DEMO_ACCOUNTS[kind];
  try {
    await getAuth().api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (e) {
    return { message: friendlyAuthError(codeOf(e)) };
  }
  redirect(to);
}

export const demoSignInAction = async (): Promise<FormState> => demoSignIn("customer", "/account");
/** The read-only admin viewer, so portfolio visitors can look around the dashboard. */
export const demoViewerSignInAction = async (): Promise<FormState> => demoSignIn("viewer", "/admin");

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/account/sign-in");
  if (user.isDemo) return { message: friendlyAuthError("FORBIDDEN") };
  if (form.get("confirm") !== "yes") return { errors: { confirm: "Tick the box to confirm." } };
  const password = String(form.get("password") ?? "");
  if (!password) return { errors: { password: "Enter your password to confirm." } };
  try {
    await getAuth().api.deleteUser({ body: { password }, headers: await headers() });
  } catch (e) {
    return { message: friendlyAuthError(codeOf(e)) };
  }
  redirect("/?account=deleted");
}
