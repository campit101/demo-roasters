import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/admin/access";
import { getAdminProduct } from "@/admin/data";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImage } from "@/components/ProductImage";
import { canEdit } from "@/lib/admin-forms";

export const dynamic = "force-dynamic";

export default async function AdminProduct({ params }: PageProps<"/admin/products/[slug]">) {
  const user = await requireStaff();
  const p = await getAdminProduct((await params).slug);
  if (!p) notFound();
  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href="/admin/products" className="hover:text-ink">
          Products
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span aria-current="page">{p.name}</span>
      </nav>
      <div className="mt-5 grid gap-8 md:grid-cols-[18rem_1fr]">
        <div>
          <ProductImage product={{ ...p, category: p.category }} sizes="18rem" alt={`Photo of ${p.name}`} />
          <Link href={`/products/${p.slug}`} className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">
            See it in the shop
          </Link>
        </div>
        <ProductForm product={p} readOnly={!canEdit(user)} />
      </div>
    </div>
  );
}
