import type { AdminOrder } from "@/admin/data";
import { formatPrice } from "@/lib/format";

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" });
const STATUS: Record<string, string> = { paid: "Paid (test)", pending: "Waiting for payment", expired: "Expired", cancelled: "Cancelled" };

/** Orders without personal details: a short reference only, never emails, user ids or Stripe ids. */
export function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <p className="rounded-2xl bg-sand px-5 py-6 text-center text-ink-soft">No orders yet.</p>;
  return (
    <div tabIndex={0} role="region" aria-label="Orders table" className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-full min-w-[36rem] text-left text-[0.95rem] tabular-nums">
        <thead className="bg-sand text-sm text-ink-soft">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Order</th>
            <th scope="col" className="px-4 py-3 font-medium">Placed</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Customer</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Items</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={`${o.shortReference}-${i}`} className="border-t border-line">
              <td className="px-4 py-3 font-mono text-sm">{o.shortReference}</td>
              <td className="px-4 py-3">{WHEN.format(new Date(o.createdAt))}</td>
              <td className="px-4 py-3">{STATUS[o.status] ?? o.status}</td>
              <td className="px-4 py-3">{o.signedIn ? "Account" : "Guest"}</td>
              <td className="px-4 py-3 text-right">{o.items}</td>
              <td className="px-4 py-3 text-right">{formatPrice(o.totalPence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
