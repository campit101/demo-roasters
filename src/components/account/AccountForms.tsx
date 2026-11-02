"use client";

// Sign-in, create-account, demo sign-in and delete-account forms. Plain forms posting to server actions, so they
// work without JavaScript; with it, they show errors inline and a busy label while sending.
import Link from "next/link";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction, demoSignInAction, demoViewerSignInAction, signInAction, signUpAction, type FormState } from "@/auth/actions";
import { ACCOUNTS, DEMO_ACCOUNTS } from "@/config/shop";

const input =
  "mt-1.5 h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-soft/70 aria-[invalid=true]:border-accent";

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  state,
  hint,
  spellCheck,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete: string;
  state: FormState;
  hint?: string;
  spellCheck?: boolean;
}) {
  const id = useId();
  const error = state.errors?.[name];
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={type === "password" ? undefined : state.values?.[name]}
        spellCheck={spellCheck}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={input}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-accent">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Submit({ idle, busy, secondary = false }: { idle: string; busy: string; secondary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn ${secondary ? "btn-secondary" : "btn-primary"} w-full`}>
      {pending ? busy : idle}
    </button>
  );
}

const Message = ({ state }: { state: FormState }) => (
  <p aria-live="polite" className="text-sm font-medium text-accent empty:hidden">
    {state.message ?? ""}
  </p>
);

export function SignInForm() {
  const [state, action] = useActionState(signInAction, {});
  return (
    <form action={action} noValidate className="space-y-4">
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} spellCheck={false} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" state={state} />
      <Message state={state} />
      <Submit idle="Sign in" busy="Signing in…" />
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, {});
  return (
    <form action={action} noValidate className="space-y-4">
      <Field name="name" label="First name" autoComplete="given-name" state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} spellCheck={false} hint="Any address works: this demo never sends emails." />
      <Field name="password" label="Password" type="password" autoComplete="new-password" state={state} hint={`At least ${ACCOUNTS.passwordMinLength} characters.`} />
      <Message state={state} />
      <Submit idle="Create account" busy="Creating account…" />
    </form>
  );
}

export function DemoSignIn() {
  const [state, action] = useActionState(demoSignInAction, {});
  return (
    <form action={action} className="space-y-3">
      <Message state={state} />
      <Submit idle="Sign in as the demo customer" busy="Signing in…" secondary />
      <p className="text-center text-sm text-ink-soft">
        Or type <span className="font-semibold text-ink">{DEMO_ACCOUNTS.customer.email}</span> with the password{" "}
        <span className="font-semibold text-ink">{DEMO_ACCOUNTS.customer.password}</span>.
      </p>
    </form>
  );
}

export function DemoViewerSignIn() {
  const [state, action] = useActionState(demoViewerSignInAction, {});
  return (
    <form action={action} className="space-y-3">
      <Message state={state} />
      <Submit idle="Look around the admin dashboard" busy="Opening…" secondary />
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, {});
  const confirmId = useId();
  return (
    <form action={action} noValidate className="space-y-4">
      <Field name="password" label="Your password" type="password" autoComplete="current-password" state={state} />
      <div>
        <label htmlFor={confirmId} className="flex items-start gap-3 text-[0.95rem]">
          <input id={confirmId} type="checkbox" name="confirm" value="yes" className="mt-1 h-4 w-4 accent-[var(--ink)]" />
          Delete my account now. My test orders stay, with no link to me. This cannot be undone.
        </label>
        {state.errors?.confirm && <p className="mt-1.5 text-sm font-medium text-accent">{state.errors.confirm}</p>}
      </div>
      <Message state={state} />
      <Submit idle="Delete my account" busy="Deleting…" secondary />
    </form>
  );
}

export const AuthSwitch = ({ to }: { to: "sign-in" | "create" }) =>
  to === "create" ? (
    <p className="text-[0.95rem] text-ink-soft">
      New here?{" "}
      <Link href="/account/create" className="font-semibold text-ink underline underline-offset-4">
        Create an account
      </Link>
    </p>
  ) : (
    <p className="text-[0.95rem] text-ink-soft">
      Already have an account?{" "}
      <Link href="/account/sign-in" className="font-semibold text-ink underline underline-offset-4">
        Sign in
      </Link>
    </p>
  );
