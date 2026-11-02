import { describe, expect, it } from "vitest";
import { ACCOUNTS, DEMO_ACCOUNTS } from "@/config/shop";
import { deletionDate, friendlyAuthError, readSignIn, readSignUp } from "@/lib/account-forms";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("sign-up form", () => {
  it("accepts a name, an email and a long enough password, trimming and lower-casing the email", () => {
    const r = readSignUp(form({ name: " Ada ", email: " Ada@Example.COM ", password: "a-long-password" }));
    expect(r).toEqual({ ok: true, value: { name: "Ada", email: "ada@example.com", password: "a-long-password" } });
  });

  it("explains each problem next to its field", () => {
    const r = readSignUp(form({ name: "", email: "not-an-email", password: "short" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.name).toMatch(/name/i);
    expect(r.errors.email).toMatch(/email/i);
    expect(r.errors.password).toContain(String(ACCOUNTS.passwordMinLength));
  });

  it("refuses the demo addresses so nobody can register them", () => {
    const r = readSignUp(form({ name: "X", email: DEMO_ACCOUNTS.customer.email, password: "a-long-password" }));
    expect(r.ok).toBe(false);
  });

  it("refuses very long input", () => {
    expect(readSignUp(form({ name: "x".repeat(81), email: "a@b.co", password: "a-long-password" })).ok).toBe(false);
    expect(readSignUp(form({ name: "X", email: "a@b.co", password: "x".repeat(ACCOUNTS.passwordMaxLength + 1) })).ok).toBe(false);
  });
});

describe("sign-in form", () => {
  it("needs both fields", () => {
    expect(readSignIn(form({ email: "a@b.co", password: "" })).ok).toBe(false);
    expect(readSignIn(form({ email: "A@B.co", password: "x" }))).toEqual({ ok: true, value: { email: "a@b.co", password: "x" } });
  });
});

describe("messages", () => {
  it("never says whether an email is registered when sign-in fails", () => {
    expect(friendlyAuthError("INVALID_EMAIL_OR_PASSWORD")).toBe("That email and password do not match an account.");
  });

  it("explains a taken email at sign-up", () => {
    expect(friendlyAuthError("USER_ALREADY_EXISTS")).toMatch(/already/i);
  });

  it("falls back to a general message", () => {
    expect(friendlyAuthError("SOMETHING_ELSE")).toMatch(/try again/i);
  });

  it("dates deletion 30 days after the account was made", () => {
    expect(deletionDate(new Date("2026-10-25T10:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-24");
  });
});
