"use server";

// Admin writes. The server checks the role on every save: the demo viewer and customers are refused here,
// whatever the page shows.
import { revalidatePath, updateTag } from "next/cache";
import { getCurrentUser } from "@/auth/session";
import { canEdit, readProductEdit } from "@/lib/admin-forms";
import { saveProduct } from "./data";

export interface SaveState {
  message?: string;
  saved?: boolean;
  errors?: Partial<Record<string, string>>;
}

export async function saveProductAction(slug: string, _prev: SaveState, form: FormData): Promise<SaveState> {
  const user = await getCurrentUser();
  if (!user || !canEdit(user)) return { message: "This is the read-only demo viewer: saving is switched off. Nothing was changed." };
  const read = readProductEdit(form);
  if (!read.ok) return { errors: read.errors };
  await saveProduct(slug, read.value);
  updateTag("catalogue"); // read-your-writes: the admin sees the change at once
  revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/products");
  return { saved: true, message: "Saved. The shop shows the change straight away." };
}
