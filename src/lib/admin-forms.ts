// Admin rules apart from the pages, so they are tested: who may save, and reading the product form.

/** Only a real admin saves. The demo viewer (and any demo account) only looks; the server refuses its writes. */
export const canEdit = (u: { role: string; isDemo: boolean }) => u.role === "admin" && !u.isDemo;

export interface ProductEdit {
  name: string;
  description: string;
  pricePence: number;
  stock: number;
  flavourNotes: string[];
  active: boolean;
}

type Field = "name" | "description" | "price" | "stock" | "flavourNotes";
const text = (f: FormData, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : "");

export function readProductEdit(f: FormData): { ok: true; value: ProductEdit } | { ok: false; errors: Partial<Record<Field, string>> } {
  const errors: Partial<Record<Field, string>> = {};
  const name = text(f, "name").trim();
  const description = text(f, "description").trim();
  const price = text(f, "price").trim();
  const stock = text(f, "stock").trim();
  const flavourNotes = text(f, "flavourNotes")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  if (!name || name.length > 80) errors.name = "Enter a name of 80 characters at most.";
  if (!description || description.length > 600) errors.description = "Enter a description of 600 characters at most.";
  // Matches the database checks: price 1p to £1,000, stock a whole number from 0.
  const pricePence = /^\d{1,4}(\.\d{1,2})?$/.test(price) ? Math.round(Number(price) * 100) : NaN;
  if (!(pricePence >= 1 && pricePence <= 100000)) errors.price = "Enter a price from £0.01 to £1,000, like 11.50.";
  const stockN = /^\d{1,5}$/.test(stock) ? Number(stock) : NaN;
  if (!(stockN >= 0)) errors.stock = "Enter a whole number from 0.";
  if (flavourNotes.length > 6 || flavourNotes.some((n) => n.length > 40)) errors.flavourNotes = "Use up to 6 short notes, separated by commas.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, description, pricePence, stock: stockN, flavourNotes, active: f.get("active") === "on" } };
}

/** "Copán Gold, Reserve!" -> "copan-gold-reserve" */
export const slugFor = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
