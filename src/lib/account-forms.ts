// Reading and checking the account forms, apart from the pages so the rules are tested.
import { ACCOUNTS, DEMO_ACCOUNTS, LIMITS } from "@/config/shop";

type Result<T, F extends string> = { ok: true; value: T } | { ok: false; errors: Partial<Record<F, string>> };

const text = (f: FormData, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEMO_EMAILS: readonly string[] = Object.values(DEMO_ACCOUNTS).map((a) => a.email);

export function readSignUp(f: FormData): Result<{ name: string; email: string; password: string }, "name" | "email" | "password"> {
  const name = text(f, "name").trim();
  const email = text(f, "email").trim().toLowerCase();
  const password = text(f, "password");
  const errors: Partial<Record<"name" | "email" | "password", string>> = {};
  if (!name) errors.name = "Enter your first name.";
  else if (name.length > 80) errors.name = "Use a shorter name (80 characters at most).";
  if (!EMAIL.test(email) || email.length > 254) errors.email = "Enter an email address like name@example.com.";
  else if (DEMO_EMAILS.includes(email)) errors.email = "That address belongs to a demo account. Use the demo sign-in instead.";
  if (password.length < ACCOUNTS.passwordMinLength) errors.password = `Use at least ${ACCOUNTS.passwordMinLength} characters.`;
  else if (password.length > ACCOUNTS.passwordMaxLength) errors.password = `Use ${ACCOUNTS.passwordMaxLength} characters at most.`;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, email, password } };
}

export function readSignIn(f: FormData): Result<{ email: string; password: string }, "email" | "password"> {
  const email = text(f, "email").trim().toLowerCase();
  const password = text(f, "password");
  const errors: Partial<Record<"email" | "password", string>> = {};
  if (!email) errors.email = "Enter your email address.";
  if (!password) errors.password = "Enter your password.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { email, password } };
}

/** Plain-English messages for Better Auth error codes. Sign-in failures never reveal whether an email is registered. */
export function friendlyAuthError(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
      return "That email and password do not match an account.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "There is already an account with that email. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${ACCOUNTS.passwordMinLength} characters.`;
    case "FORBIDDEN":
      return "Demo accounts cannot be changed or deleted.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** When an account made at `created` is deleted automatically (CONSTRAINTS.md: after 30 days). */
export const deletionDate = (created: Date) => new Date(created.getTime() + LIMITS.accountRetentionDays * 24 * 60 * 60 * 1000);
