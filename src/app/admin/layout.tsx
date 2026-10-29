import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireStaff } from "@/admin/access";
import { AdminNav } from "@/components/admin/AdminNav";
import { canEdit } from "@/lib/admin-forms";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Admin</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Shop dashboard</h1>
        </div>
        <AdminNav />
      </div>
      {!canEdit(user) && (
        <p className="mt-5 rounded-2xl bg-sand px-5 py-4 text-[0.95rem]">
          <strong>Read-only demo viewer.</strong> Look around everything an admin sees. Saving is switched off, and personal details
          are never shown.
        </p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  );
}
