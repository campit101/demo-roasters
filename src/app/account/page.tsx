import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { paidOrdersFor } from "@/account/orders";
import { signOutAction } from "@/auth/actions";
import { getCurrentUser } from "@/auth/session";
import { DeleteAccountForm } from "@/components/account/AccountForms";
import { GRIND_LABEL, type Grind } from "@/config/shop";
import { deletionDate } from "@/lib/account-forms";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/sign-in");
  const orders = await paidOrdersFor(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 md:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Your account</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">Hello, {user.name}.</h1>
          <p className="mt-2 break-all text-ink-soft">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(user.role === "admin" || user.role === "viewer") && (
            <Link href="/admin" className="btn btn-primary">
              Admin dashboard
            </Link>
          )}
          <form action={signOutAction}>
            <button type="submit" className="btn btn-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {user.isDemo && (
        <p className="mt-6 rounded-2xl bg-sand px-5 py-4 text-[0.95rem]">
          You are using the shared {user.role === "viewer" ? "demo admin viewer" : "demo customer"}. Anyone can sign in with it, so it
          cannot be changed or deleted, and its order history is cleared every night.
        </p>
      )}

      <section aria-labelledby="orders" className="mt-12">
        <h2 id="orders" className="text-2xl sm:text-3xl">
          Your orders
        </h2>
        {orders.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius-card)] bg-sand px-6 py-10 text-center">
            <p className="text-lg font-semibold">No orders yet.</p>
            <p className="mt-1 text-ink-soft">Test orders you place while signed in appear here.</p>
            <Link href="/shop/coffee" className="btn btn-primary mt-5">
              Shop coffee
            </Link>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-line rounded-[var(--radius-card)] border border-line">
            {orders.map((o) => (
              <li key={o.reference} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="font-semibold">{DATE.format(o.paidAt ?? o.createdAt)}</p>
                  <ul className="mt-1 text-[0.95rem] text-ink-soft">
                    {o.lines.map((l, i) => (
                      <li key={i} className="break-words">
                        {l.quantity} × {l.name}
                        {l.grind ? `, ${GRIND_LABEL[l.grind as Grind] ?? l.grind}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatPrice(o.totalPence)}</p>
                  <Link href={`/order/${o.reference}`} className="text-sm underline underline-offset-4 hover:text-accent">
                    View order
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!user.isDemo && (
        <section aria-labelledby="delete" className="mt-16 grid gap-6 border-t border-line pt-10 md:grid-cols-2">
          <div>
            <h2 id="delete" className="text-2xl">
              Delete your account
            </h2>
            <p className="mt-2 text-ink-soft">
              Your account will be deleted automatically on or just after {DATE.format(deletionDate(user.createdAt))}. You can delete it
              now instead: your name, email and password are removed straight away, and your test orders stay without any link to you.
            </p>
          </div>
          <DeleteAccountForm />
        </section>
      )}
    </div>
  );
}
