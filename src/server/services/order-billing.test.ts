import { describe, expect, it } from "bun:test";
import { db } from "../../db";
import { assertInvoiceGate, lookupByToken, type BillingKind } from "./order-billing";

describe("Billing seam dispatch", () => {
  it.each(["buku", "seragam"] as const)("lookupByToken unknown token returns null for %s", async (kind: BillingKind) => {
    expect(await lookupByToken(db, `tok-ghost-${kind}`, kind)).toBeNull();
  });

  it("assertInvoiceGate seragam passes without extra gate", async () => {
    const gate = await assertInvoiceGate(
      db,
      { role: "central_admin", schoolId: null },
      "order-ghost",
      "seragam"
    );
    expect(gate).toBeNull();
  });
});
