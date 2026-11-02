// Which account an order belongs to: the signed-in customer (Better Auth session, read on the server), or null
// for a guest. Called only from the checkout route, inside a request.
import "server-only";
import { getCurrentUser } from "@/auth/session";

export async function currentUserIdForOrder(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}
