import { requireStaff } from "@/admin/access";
import Link from "next/link";
import { listProducts } from "@/admin/data";
import { categoryPage } from "@/config/categories";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  // Checked here as well as in the layout: a layout does not re-run on every navigation.
  await requireStaff();
  const products = await listProducts();
  return (
    <section aria-labelledby="products">
      <h2 id="products" className="text-xl">
        Products
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Held means set aside for a checkout that has not finished yet. Free to sell is stock minus held.
      </p>
      <div tabIndex={0} role="region" aria-label="Products table" className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full min-w-[40rem] text-left text-[0.95rem] tabular-nums">
          <thead className="bg-sand text-sm text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">Range</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Held</th>
              <th scope="col" className="px-4 py-3 font-medium">In the shop</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.slug} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${p.slug}`} className="font-semibold underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{categoryPage(p.category).name}</td>
                <td className="px-4 py-3 text-right">{formatPrice(p.pricePence)}</td>
                <td className={`px-4 py-3 text-right ${p.stock === 0 ? "font-semibold text-accent" : ""}`}>{p.stock}</td>
                <td className="px-4 py-3 text-right">{p.held}</td>
                <td className="px-4 py-3">{p.active ? "Shown" : "Hidden"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
