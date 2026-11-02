"use client";

// Edit a product. Works without JavaScript (a plain form posting to a server action); the server refuses saves
// from the demo viewer whatever this page shows.
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import type { AdminProduct } from "@/admin/data";
import { saveProductAction, type SaveState } from "@/admin/actions";

const input = "mt-1.5 w-full rounded-xl border border-line bg-surface px-4 text-base text-ink aria-[invalid=true]:border-accent";

function Field({ name, label, state, children, hint }: { name: string; label: string; state: SaveState; children: (p: { id: string; invalid?: true; describedBy?: string }) => React.ReactNode; hint?: string }) {
  const id = useId();
  const error = state.errors?.[name];
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children({ id, invalid: error ? true : undefined, describedBy: error ? `${id}-e` : hint ? `${id}-h` : undefined })}
      {error ? (
        <p id={`${id}-e`} className="mt-1.5 text-sm font-medium text-accent">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-h`} className="mt-1.5 text-sm text-ink-soft">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function ProductForm({ product: p, readOnly }: { product: AdminProduct; readOnly: boolean }) {
  const [state, action] = useActionState(saveProductAction.bind(null, p.slug), {});
  return (
    <form action={action} noValidate className="space-y-5">
      <Field name="name" label="Name" state={state}>
        {(a) => <input id={a.id} name="name" defaultValue={p.name} autoComplete="off" aria-invalid={a.invalid} aria-describedby={a.describedBy} className={`${input} h-12`} />}
      </Field>
      <Field name="description" label="Description" state={state} hint="Up to 600 characters. Search reads this.">
        {(a) => (
          <textarea id={a.id} name="description" defaultValue={p.description} rows={5} aria-invalid={a.invalid} aria-describedby={a.describedBy} className={`${input} py-3`} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="price" label="Price (£)" state={state}>
          {(a) => (
            <input id={a.id} name="price" inputMode="decimal" autoComplete="off" defaultValue={(p.pricePence / 100).toFixed(2)} aria-invalid={a.invalid} aria-describedby={a.describedBy} className={`${input} h-12 tabular-nums`} />
          )}
        </Field>
        <Field name="stock" label="Stock" state={state} hint={p.held ? `${p.held} held for open checkouts.` : undefined}>
          {(a) => (
            <input id={a.id} name="stock" inputMode="numeric" autoComplete="off" defaultValue={p.stock} aria-invalid={a.invalid} aria-describedby={a.describedBy} className={`${input} h-12 tabular-nums`} />
          )}
        </Field>
      </div>
      <Field name="flavourNotes" label="Tastes of" state={state} hint="Separate notes with commas. The first note sets the colour on the shop.">
        {(a) => <input id={a.id} name="flavourNotes" defaultValue={p.flavourNotes.join(", ")} autoComplete="off" aria-invalid={a.invalid} aria-describedby={a.describedBy} className={`${input} h-12`} />}
      </Field>
      <label className="flex items-center gap-3 text-[0.95rem]">
        <input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-[var(--ink)]" />
        Show this product in the shop
      </label>
      <p aria-live="polite" className={`text-sm font-medium empty:hidden ${state.saved ? "text-ink" : "text-accent"}`}>
        {state.message ?? ""}
      </p>
      {readOnly && <p className="text-sm text-ink-soft">Try saving: the server will refuse it, because this is the read-only viewer.</p>}
      <Save />
    </form>
  );
}
