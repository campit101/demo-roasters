import { requireStaff } from "@/admin/access";
import { recentOrders } from "@/admin/data";
import { OrdersTable } from "@/components/admin/OrdersTable";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  // Checked here as well as in the layout: a layout does not re-run on every navigation.
  await requireStaff();
  const orders = await recentOrders(100);
  return (
    <section aria-labelledby="orders">
      <h2 id="orders" className="text-xl">
        Orders
      </h2>
      <p className="mt-1 text-sm text-ink-soft">The latest 100 test orders, newest first. Customers are shown only as account or guest.</p>
      <div className="mt-4">
        <OrdersTable orders={orders} />
      </div>
    </section>
  );
}
