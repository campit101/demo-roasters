// A signed-in customer's paid orders, newest first, for the account page.
import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orderItems, orders } from "@/db/schema";

export interface OrderSummary {
  reference: string;
  paidAt: Date | null;
  createdAt: Date;
  totalPence: number;
  lines: { name: string; quantity: number; grind: string | null }[];
}

export async function paidOrdersFor(userId: string): Promise<OrderSummary[]> {
  const db = getDb();
  const rows = await db
    .select({ id: orders.id, reference: orders.reference, paidAt: orders.paidAt, createdAt: orders.createdAt, totalPence: orders.totalPence })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid")))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  if (rows.length === 0) return [];
  const items = await db
    .select({ orderId: orderItems.orderId, name: orderItems.name, quantity: orderItems.quantity, grind: orderItems.grind })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    reference: r.reference,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
    totalPence: r.totalPence,
    lines: items.filter((i) => i.orderId === r.id).map(({ name, quantity, grind }) => ({ name, quantity, grind })),
  }));
}
