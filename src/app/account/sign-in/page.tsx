import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/session";
import { AuthSwitch, DemoSignIn, DemoViewerSignIn, SignInForm } from "@/components/account/AccountForms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 pt-10 sm:px-6 md:grid-cols-2 md:gap-10 md:pt-16">
      <section aria-labelledby="sign-in" className="rounded-[var(--radius-card)] border border-line p-6 sm:p-8">
        <h1 id="sign-in" className="text-3xl sm:text-4xl">
          Sign in
        </h1>
        <p className="mt-2 text-ink-soft">See your test orders and manage your account.</p>
        <div className="mt-6">
          <SignInForm />
        </div>
        <div className="mt-6">
          <AuthSwitch to="create" />
        </div>
      </section>
      <section aria-labelledby="demo" className="rounded-[var(--radius-card)] bg-sand p-6 sm:p-8">
        <p className="label">Just looking?</p>
        <h2 id="demo" className="mt-3 text-2xl sm:text-3xl">
          Try the demo customer
        </h2>
        <p className="mt-2 text-ink-soft">
          A ready-made account anyone can use. It cannot be changed or deleted, and it is tidied every night.
        </p>
        <div className="mt-6">
          <DemoSignIn />
        </div>
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-lg">See the shop from behind the counter</h2>
          <p className="mt-1 text-[0.95rem] text-ink-soft">A read-only admin view: sales, orders and stock. Nothing can be changed.</p>
          <div className="mt-4">
            <DemoViewerSignIn />
          </div>
        </div>
      </section>
    </div>
  );
}
