import { requireStaff } from "@/admin/access";
import Link from "next/link";
import { overview, recentOrders, salesByDay } from "@/admin/data";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { SalesChart } from "@/components/admin/SalesChart";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  // Checked here as well as in the layout: a layout does not re-run on every navigation.
  await requireStaff();
  const [o, days, orders] = await Promise.all([overview(30), salesByDay(30), recentOrders(8)]);
  const tiles = [
    { label: "Paid test orders, 30 days", value: String(o.paidOrders) },
    { label: "Test takings, 30 days", value: formatPrice(o.testRevenuePence) },
    { label: "Items sold, 30 days", value: String(o.itemsSold) },
    { label: "Open checkouts now", value: String(o.openCheckouts) },
    { label: "Searches, 7 days", value: String(o.searches7d) },
    { label: "Products with 5 or fewer left", value: String(o.lowStock) },
  ];
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-2xl bg-sand p-4">
            <p className="text-sm text-ink-soft">{t.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-soft">Every figure is from test payments in Stripe’s sandbox: no money has moved.</p>

      <section aria-labelledby="sales" className="mt-10 rounded-[var(--radius-card)] border border-line p-5 sm:p-6">
        <h2 id="sales" className="text-xl">
          Paid test orders per day
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Last 30 days, UK time.</p>
        <div className="mt-4">
          <SalesChart days={days} />
        </div>
      </section>

      <section aria-labelledby="recent" className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 id="recent" className="text-xl">
            Latest orders
          </h2>
          <Link href="/admin/orders" className="font-semibold underline-offset-4 hover:underline">
            All orders
          </Link>
        </div>
        <div className="mt-4">
          <OrdersTable orders={orders} />
        </div>
      </section>
    </>
  );
}
