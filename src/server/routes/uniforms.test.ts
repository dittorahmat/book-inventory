import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { uniformsRouter } from "./uniforms";
import { db } from "../../db";
import { suppliers, uniformVariants, uniformSizes, uniformStock } from "../../db/schema";

const postJson = (path: string, body: unknown) =>
  uniformsRouter.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("Uniform catalog, PO & assembly API", () => {
  it("menolak kain ber-size dan olahraga tanpa size", async () => {
    const stamp = Date.now();
    const kainRes = await postJson("/variants", {
      code: `UK-T3-KAIN-${stamp}`, name: "Kain Harian SD L", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 120000, sizes: ["S"],
    });
    expect(kainRes.status).toBe(400);
    const olRes = await postJson("/variants", {
      code: `UO-T3-OL-${stamp}`, name: "Olahraga SD L", kind: "olahraga",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 95000, sizes: [],
    });
    expect(olRes.status).toBe(400);
  });

  it("alur penuh: varian -> paket -> PO campur -> terima -> rakit", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const supplierId = `sup-u-${stamp}`;
    await db.insert(suppliers).values({
      id: supplierId, name: "Konveksi Test", code: `KONV-U-${stamp}`, createdAt: now, updatedAt: now,
    });

    const kainRes = await postJson("/variants", {
      code: `UK-FULL-${stamp}`, name: "Kain Harian SD L", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 120000,
    });
    expect(kainRes.status).toBe(201);
    const kainId = (await kainRes.json()).data.variant.id;

    const olRes = await postJson("/variants", {
      code: `UO-FULL-${stamp}`, name: "Olahraga SD L", kind: "olahraga",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 95000, sizes: ["S", "M"],
    });
    expect(olRes.status).toBe(201);
    const olId = (await olRes.json()).data.variant.id;

    const dupRes = await postJson("/variants", {
      code: `UK-FULL-${stamp}`, name: "Duplikat", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027",
    });
    expect(dupRes.status).toBe(400);

    const pkgRes = await postJson("/packages", {
      code: `UPK-FULL-${stamp}`, name: "Paket Seragam SD L", academicYear: "2026/2027",
      items: [{ variantId: kainId, quantity: 1 }, { variantId: olId, quantity: 1 }],
    });
    expect(pkgRes.status).toBe(201);
    const pkgId = (await pkgRes.json()).data.id;

    // PO campur kain + olahraga; baris olahraga ber-size tak terdaftar ditolak
    const badPo = await postJson("/pos", {
      supplierId, lines: [{ variantId: olId, size: "XXL", quantityOrdered: 2, unitPrice: 95000 }],
    });
    expect(badPo.status).toBe(400);

    const poRes = await postJson("/pos", {
      supplierId,
      lines: [
        { variantId: kainId, quantityOrdered: 10, unitPrice: 120000 },
        { variantId: olId, size: "M", quantityOrdered: 6, unitPrice: 95000 },
      ],
    });
    expect(poRes.status).toBe(201);
    const poId = (await poRes.json()).data.id;

    const overRes = await postJson(`/pos/${poId}/receive`, {
      lines: [{ variantId: kainId, quantity: 11 }],
    });
    expect(overRes.status).toBe(400);

    const recvRes = await postJson(`/pos/${poId}/receive`, {
      lines: [{ variantId: kainId, quantity: 10 }, { variantId: olId, size: "M", quantity: 6 }],
    });
    expect(recvRes.status).toBe(200);
    expect((await recvRes.json()).data.status).toBe("received");

    const variantsRes = await uniformsRouter.request("/variants", { method: "GET" });
    const listed = (await variantsRes.json()).data as Array<{ variant: { id: string }; stock: Array<{ size: string; quantity: number }> }>;
    const kainStock = listed.find((v) => v.variant.id === kainId)?.stock.find((s) => s.size === "—")?.quantity;
    expect(kainStock).toBe(10);

    // Rakit tanpa size override untuk olahraga BOM "—" ditolak; dengan override lolos
    const noSize = await postJson(`/packages/${pkgId}/assemble`, { quantity: 2 });
    expect(noSize.status).toBe(400);
    const asmRes = await postJson(`/packages/${pkgId}/assemble`, { quantity: 2, sizeOverrides: { [olId]: "M" } });
    expect(asmRes.status).toBe(200);

    const pkgsRes = await uniformsRouter.request("/packages", { method: "GET" });
    const pkgs = (await pkgsRes.json()).data as Array<{ package: { id: string }; readyQty: number }>;
    expect(pkgs.find((p) => p.package.id === pkgId)?.readyQty).toBe(2);

    const shortRes = await postJson(`/packages/${pkgId}/assemble`, { quantity: 99, sizeOverrides: { [olId]: "M" } });
    expect(shortRes.status).toBe(400);
  });

  it("PO + terima 30 baris sekaligus lolos di kedua runtime (chunked, sekuensial)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const supplierId = crypto.randomUUID();
    await db.insert(suppliers).values({
      id: supplierId, name: "Konveksi Volume", code: `KONV-VOL-${stamp}`, createdAt: now, updatedAt: now,
    });
    for (let i = 0; i < 30; i++) {
      const vid = `uv-vol-${stamp}-${i}`;
      await db.insert(uniformVariants).values({
        id: vid, code: `UV-VOL-${stamp}-${i}`, name: `Kain Vol ${i}`, kind: "kain_harian",
        gender: i % 2 === 0 ? "male" : "female", jenjang: "sd", academicYear: "2026/2027",
        price: 50000 + i, createdAt: now, updatedAt: now,
      });
      await db.insert(uniformSizes).values({ id: `us-vol-${stamp}-${i}`, variantId: vid, size: "—", sortOrder: 0, createdAt: now });
      await db.insert(uniformStock).values({ id: `ust-vol-${stamp}-${i}`, variantId: vid, size: "—", quantity: 0, updatedAt: now });
    }
    const poRes = await postJson("/pos", {
      supplierId,
      lines: Array.from({ length: 30 }, (_, i) => ({
        variantId: `uv-vol-${stamp}-${i}`, quantityOrdered: 2, unitPrice: 50000 + i,
      })),
    });
    expect(poRes.status).toBe(201);
    const poId = (await poRes.json()).data.id;
    const recvRes = await postJson(`/pos/${poId}/receive`, {
      lines: Array.from({ length: 30 }, (_, i) => ({ variantId: `uv-vol-${stamp}-${i}`, quantity: 2 })),
    });
    expect(recvRes.status).toBe(200);
    expect((await recvRes.json()).data.status).toBe("received");
  });
});
