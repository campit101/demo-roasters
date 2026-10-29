import { describe, expect, it } from "vitest";
import { canEdit, readProductEdit, slugFor } from "@/lib/admin-forms";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const ok = { name: "Hillside Sunrise", description: "A bright coffee.", price: "11.50", stock: "12", flavourNotes: "blueberry, jasmine", active: "on" };

describe("who may change the shop", () => {
  it("lets only a real admin save; the demo viewer and customers may only look", () => {
    expect(canEdit({ role: "admin", isDemo: false })).toBe(true);
    expect(canEdit({ role: "viewer", isDemo: true })).toBe(false);
    expect(canEdit({ role: "admin", isDemo: true })).toBe(false);
    expect(canEdit({ role: "customer", isDemo: false })).toBe(false);
  });
});

describe("product edit form", () => {
  it("reads pounds into whole pence and notes into a list", () => {
    expect(readProductEdit(form(ok))).toEqual({
      ok: true,
      value: { name: "Hillside Sunrise", description: "A bright coffee.", pricePence: 1150, stock: 12, flavourNotes: ["blueberry", "jasmine"], active: true },
    });
  });

  it("refuses prices, stock and text outside the database's limits", () => {
    const r = readProductEdit(form({ ...ok, price: "0", stock: "-1", name: "", description: "x".repeat(601) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["description", "name", "price", "stock"]);
    expect(readProductEdit(form({ ...ok, price: "1000.01" })).ok).toBe(false);
    expect(readProductEdit(form({ ...ok, price: "12.345" })).ok).toBe(false);
    expect(readProductEdit(form({ ...ok, stock: "2.5" })).ok).toBe(false);
  });

  it("treats a missing active box as hidden from the shop", () => {
    const { active, ...rest } = ok;
    void active;
    const r = readProductEdit(form(rest));
    expect(r.ok && r.value.active).toBe(false);
  });

  it("makes clean addresses from names", () => {
    expect(slugFor("Copán Gold, Reserve!")).toBe("copan-gold-reserve");
  });
});
