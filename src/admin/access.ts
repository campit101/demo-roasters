// Who may open the admin pages: real admins, and the read-only demo viewer. Everyone else gets "not found",
// and signed-out visitors are sent to sign in.
import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type SignedInUser } from "@/auth/session";

export async function requireStaff(): Promise<SignedInUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/account/sign-in");
  if (user.role !== "admin" && user.role !== "viewer") notFound();
  return user;
}
