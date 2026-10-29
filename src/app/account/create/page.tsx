import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/session";
import { AuthSwitch, SignUpForm } from "@/components/account/AccountForms";
import { LIMITS } from "@/config/shop";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function CreateAccountPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <div className="mx-auto max-w-lg px-4 pt-10 sm:px-6 md:pt-16">
      <section aria-labelledby="create" className="rounded-[var(--radius-card)] border border-line p-6 sm:p-8">
        <h1 id="create" className="text-3xl sm:text-4xl">
          Create an account
        </h1>
        <p className="mt-2 text-ink-soft">
          Keep your test orders in one place. This is a demo: no emails are sent, and accounts are deleted automatically on or just after day{" "}
          {LIMITS.accountRetentionDays} (you can delete yours any time).
        </p>
        <div className="mt-6">
          <SignUpForm />
        </div>
        <div className="mt-6">
          <AuthSwitch to="sign-in" />
        </div>
      </section>
    </div>
  );
}
