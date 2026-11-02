// Who is signed in, for server components and actions.
import "server-only";
import { headers } from "next/headers";
import { getAuth } from "./server";

export interface SignedInUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "viewer" | "admin";
  isDemo: boolean;
  createdAt: Date;
}

export async function getCurrentUser(): Promise<SignedInUser | null> {
  // Headers first: reading them marks the page as per-request, so builds without secrets (CI) never prerender it.
  const h = await headers();
  const session = await getAuth().api.getSession({ headers: h });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; isDemo?: boolean };
  const role = u.role === "admin" || u.role === "viewer" ? u.role : "customer";
  return { id: u.id, name: u.name, email: u.email, role, isDemo: Boolean(u.isDemo), createdAt: new Date(u.createdAt) };
}
