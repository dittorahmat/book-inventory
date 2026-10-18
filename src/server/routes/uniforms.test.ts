import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { uniformsRouter } from "./uniforms";
import { db } from "../../db";
import { and, eq } from "drizzle-orm";
import { schools, students, suppliers, systemSettings, uniformOrders, uniformVariants, uniformSizes, uniformStock } from "../../db/schema";
import { deleteReceiptsForOrders, selectReceiptsForOrder } from "./test-payments";
import { requestUniformExchange, submitUniformOrder } from "../services/uniform";

const postJson = (path: string, body: unknown) =>
  uniformsRouter.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** SimMenu order paket lampau agar submit satuan lolos aturan wajib-paket. */
async function seedPriorUniformOrder(schoolId: string, studentId: string, stamp: string | number, shipped = false) {
  const now = new Date().toISOString();
  await db.insert(uniformOrders).values({
    id: `uord-prior-${stamp}`,
    orderNumber: `USO-PRIOR-${stamp}`,
    studentId, schoolId, academicYear: "2026/2027",
    homeAddressSnapshot: "Jl. Prior RT 01 RW 01, Depok 16411",
    shipmentStatus: shipped ? "sudah_dikirim" : "belum_dikirim",
    shippedAt: shipped ? now : null,
    totalAmount: 215000, paidAmount: 215000,
    createdAt: "2020-01-01T00:00:00.000Z", updatedAt: now,
  });
}

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

describe("Uniform shipment flag", () => {
  it("list terpartisi, ship gudang, tolak ganda/cabang/anonim", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolA = `sch-ua-${stamp}`;
    const schoolB = `sch-ub-${stamp}`;
    for (const [id, code] of [[schoolA, `UA-${stamp}`], [schoolB, `UB-${stamp}`]] as const) {
      await db.insert(schools).values({ id, name: `Sekolah ${code}`, code, type: "branch", createdAt: now, updatedAt: now });
    }
    const studentId = `stu-ua-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId: schoolA, nis: `NIS-UA-${stamp}`, name: `Anak Kirim ${stamp}`,
      gender: "male", gradeLevel: "3", curriculumType: "international", academicYear: "2026/2027",
      parentName: "Ortu", parentPhone: "081200000001", status: "active", createdAt: now, updatedAt: now,
    });
    const variantId = `uv-ship-${stamp}`;
    await db.insert(uniformVariants).values({
      id: variantId, code: `UV-SHIP-${stamp}`, name: "Kain Kirim", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 100000, createdAt: now, updatedAt: now,
    });
    await db.insert(uniformStock).values({ id: `ust-ship-${stamp}`, variantId, size: "—", quantity: 5, updatedAt: now });
    await seedPriorUniformOrder(schoolA, studentId, `ship-${stamp}`, true);
    const submitted = await submitUniformOrder(
      db,
      {
        studentId, academicYear: "2026/2027",
        homeAddress: "Jl. Pengiriman No. 9, RT 01 RW 01, Depok 16411",
        items: [{ variantId, quantity: 1 }],
      },
      { generateOrderNumber: () => `USO-SHIP-${stamp}` }
    );
    if (!submitted.ok) throw new Error(`setup order gagal: ${submitted.message}`);
    const orderId = submitted.data.order.id;

    const list = await uniformsRouter.request(`/orders?schoolId=${schoolA}&shipmentStatus=belum_dikirim`, { method: "GET" });
    expect(list.status).toBe(200);
    expect(((await list.json()).data as unknown[]).length).toBe(1);

    const searchGlobal = await uniformsRouter.request("/orders?search=USO-SHIP", { method: "GET" });
    expect(searchGlobal.status).toBe(400);

    mockActor("warehouse_admin", null);
    const ship = await uniformsRouter.request(`/orders/${orderId}/ship`, { method: "POST" });
    expect(ship.status).toBe(200);
    const shipped = (await ship.json()).data as { shipmentStatus: string; shippedAt: string };
    expect(shipped.shipmentStatus).toBe("sudah_dikirim");
    expect(shipped.shippedAt.length).toBeGreaterThan(0);

    const shipAgain = await uniformsRouter.request(`/orders/${orderId}/ship`, { method: "POST" });
    expect(shipAgain.status).toBe(400);

    mockActor("branch_admin", schoolA);
    const branchShip = await uniformsRouter.request(`/orders/${orderId}/ship`, { method: "POST" });
    expect(branchShip.status).toBe(403);

    mockActor("branch_admin", schoolB);
    const crossList = await uniformsRouter.request(`/orders?schoolId=${schoolA}`, { method: "GET" });
    expect(crossList.status).toBe(403);

    mockActor(null);
    const anon = await uniformsRouter.request(`/orders?schoolId=${schoolA}`, { method: "GET" });
    expect(anon.status).toBe(401);
  });
});

describe("Uniform exchange & refund", () => {
  it("tukar S->M: requested -> approved -> completed memindah stok; kain ditolak", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `sch-ur-${stamp}`;
    await db.insert(schools).values({ id: schoolId, name: `Sekolah UR-${stamp}`, code: `UR-${stamp}`, type: "branch", createdAt: now, updatedAt: now });
    const studentId = `stu-ur-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-UR-${stamp}`, name: `Anak Tukar ${stamp}`,
      gender: "male", gradeLevel: "4", curriculumType: "international", academicYear: "2026/2027",
      parentName: "Ortu", parentPhone: "081200000002", status: "active", createdAt: now, updatedAt: now,
    });
    const mkVariant = async (code: string, kind: "kain_harian" | "olahraga", sizes: string[]) => {
      const res = await uniformsRouter.request("/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, name: code, kind, gender: "male", jenjang: "sd",
          academicYear: "2026/2027", price: kind === "kain_harian" ? 120000 : 95000, sizes,
        }),
      });
      expect(res.status).toBe(201);
      return (await res.json()).data.variant.id as string;
    };
    const kainId = await mkVariant(`UK-UR-${stamp}`, "kain_harian", []);
    const olId = await mkVariant(`UO-UR-${stamp}`, "olahraga", ["S", "M"]);
    await db.update(uniformStock).set({ quantity: 5, updatedAt: now }).where(and(eq(uniformStock.variantId, kainId), eq(uniformStock.size, "—")));
    await db.update(uniformStock).set({ quantity: 3, updatedAt: now }).where(and(eq(uniformStock.variantId, olId), eq(uniformStock.size, "S")));
    await db.update(uniformStock).set({ quantity: 2, updatedAt: now }).where(and(eq(uniformStock.variantId, olId), eq(uniformStock.size, "M")));

    await seedPriorUniformOrder(schoolId, studentId, `ur-${stamp}`);
    const submitted = await submitUniformOrder(
      db,
      {
        studentId, academicYear: "2026/2027",
        homeAddress: "Jl. Tukar No. 3, RT 02 RW 01, Depok 16412",
        items: [{ variantId: olId, size: "S", quantity: 1 }, { variantId: kainId, quantity: 1 }],
      },
      { generateOrderNumber: () => `USO-UR-${stamp}` }
    );
    if (!submitted.ok) throw new Error(`setup order gagal: ${submitted.message}`);
    const orderId = submitted.data.order.id;

    const stockOf = async (size: string) =>
      (await db.select().from(uniformStock).where(eq(uniformStock.variantId, olId))).find(
        (s: typeof uniformStock.$inferSelect) => s.size === size
      )?.quantity;

    const reqRes = await uniformsRouter.request("/exchanges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, oldVariantId: olId, oldSize: "S", newVariantId: olId, newSize: "M", reason: "Kekecilan" }),
    });
    expect(reqRes.status).toBe(201);
    const exId = (await reqRes.json()).data.id as string;

    // Kain tidak bisa tukar
    const kainEx = await uniformsRouter.request("/exchanges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, oldVariantId: kainId, oldSize: "—", newVariantId: kainId, newSize: "—", reason: "Salah" }),
    });
    expect(kainEx.status).toBe(400);

    // Kadaluarsa >14 hari ditolak (service langsung, jam injeksi)
    const expired = await requestUniformExchange(
      db,
      { orderId, oldVariantId: olId, oldSize: "S", newVariantId: olId, newSize: "M", reason: "Telat" },
      { now: new Date(Date.now() + 20 * 86400000).toISOString() }
    );
    expect(expired.ok).toBe(false);

    mockActor("warehouse_admin", null);
    const approve = await uniformsRouter.request(`/exchanges/${exId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    expect(approve.status).toBe(200);
    const complete = await uniformsRouter.request(`/exchanges/${exId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    expect(complete.status).toBe(200);
    expect(await stockOf("M")).toBe(1);
    expect(await stockOf("S")).toBe(3);

    // Refund parsial memulihkan stok dan tercatat
    mockActor("central_admin", null);
    const rfReq = await uniformsRouter.request("/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, amount: 50000, reason: "Jahitan lepas" }),
    });
    expect(rfReq.status).toBe(201);
    const rfBody = (await rfReq.json()).data as { refundNumber: string; id: string };
    expect(rfBody.refundNumber.startsWith("RFD-U-")).toBe(true);
    const rfId = rfBody.id;
    const over = await uniformsRouter.request("/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, amount: 999999999, reason: "Kebesaran" }),
    });
    expect(over.status).toBe(400);

    mockActor("warehouse_admin", null);
    expect((await uniformsRouter.request(`/refunds/${rfId}/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }),
    })).status).toBe(200);
    const refunded = await uniformsRouter.request(`/refunds/${rfId}/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund" }),
    });
    expect(refunded.status).toBe(200);
    expect(await stockOf("S")).toBe(4);

    // Cabang lain tidak boleh ajukan; branch tidak boleh resolve
    mockActor("branch_admin", `sch-lain-${stamp}`);
    const cross = await uniformsRouter.request("/exchanges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, oldVariantId: olId, oldSize: "M", newVariantId: olId, newSize: "S", reason: "X" }),
    });
    expect(cross.status).toBe(403);
  });
});

describe("Uniform sales report & claims", () => {
  it("murid unik, urai paket, klaim terkunci", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const period = now.slice(0, 7);
    const schoolId = `sch-rp-${stamp}`;
    await db.insert(schools).values({ id: schoolId, name: `Sekolah RP-${stamp}`, code: `RP-${stamp}`, type: "branch", createdAt: now, updatedAt: now });
    const mkStudent = async (id: string, grade: string) =>
      db.insert(students).values({
        id, schoolId, nis: `NIS-${id}`, name: `Anak ${id}`, gender: "male", gradeLevel: grade,
        curriculumType: "international", academicYear: "2026/2027",
        parentName: "Ortu", parentPhone: "081200000003", status: "active", createdAt: now, updatedAt: now,
      });
    await mkStudent(`stu-rp1-${stamp}`, "2");
    await mkStudent(`stu-rp2-${stamp}`, "5");
    await seedPriorUniformOrder(schoolId, `stu-rp1-${stamp}`, `rp1-${stamp}`);
    await seedPriorUniformOrder(schoolId, `stu-rp2-${stamp}`, `rp2-${stamp}`);
    const mkVariant = async (code: string, kind: "kain_harian" | "olahraga", price: number) => {
      const res = await uniformsRouter.request("/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, name: code, kind, gender: "male", jenjang: "sd",
          academicYear: "2026/2027", price, sizes: kind === "olahraga" ? ["M", "L"] : [],
        }),
      });
      expect(res.status).toBe(201);
      return (await res.json()).data.variant.id as string;
    };
    const kainId = await mkVariant(`UK-RP-${stamp}`, "kain_harian", 120000);
    const olId = await mkVariant(`UO-RP-${stamp}`, "olahraga", 95000);
    await db.update(uniformStock).set({ quantity: 10, updatedAt: now }).where(and(eq(uniformStock.variantId, kainId), eq(uniformStock.size, "—")));
    await db.update(uniformStock).set({ quantity: 10, updatedAt: now }).where(and(eq(uniformStock.variantId, olId), eq(uniformStock.size, "M")));

    const pkgRes = await uniformsRouter.request("/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `UPK-RP-${stamp}`, name: "Paket RP", academicYear: "2026/2027", price: 215000,
        items: [{ variantId: kainId }, { variantId: olId }],
      }),
    });
    expect(pkgRes.status).toBe(201);
    const pkgId = (await pkgRes.json()).data.id as string;
    const asm = await uniformsRouter.request(`/packages/${pkgId}/assemble`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 5, sizeOverrides: { [olId]: "M" } }),
    });
    expect(asm.status).toBe(200);

    const addr = "Jl. Laporan No. 1, RT 01 RW 01, Depok 16413";
    const o1 = await submitUniformOrder(db, {
      studentId: `stu-rp1-${stamp}`, academicYear: "2026/2027", homeAddress: addr,
      items: [{ variantId: kainId }, { variantId: olId, size: "M" }],
    }, { generateOrderNumber: () => `USO-RP1-${stamp}` });
    const o2 = await submitUniformOrder(db, {
      studentId: `stu-rp1-${stamp}`, academicYear: "2026/2027", homeAddress: addr,
      items: [{ packageId: pkgId }],
      sizeOverrides: { [olId]: "M" },
    }, { generateOrderNumber: () => `USO-RP2-${stamp}` });
    const o3 = await submitUniformOrder(db, {
      studentId: `stu-rp2-${stamp}`, academicYear: "2026/2027", homeAddress: addr,
      items: [{ variantId: olId, size: "M", quantity: 2 }],
    }, { generateOrderNumber: () => `USO-RP3-${stamp}` });
    if (!o1.ok || !o2.ok || !o3.ok) throw new Error("setup order laporan gagal");
    const expectedRevenue = o1.data.totalAmount + o2.data.totalAmount + o3.data.totalAmount;

    const rep = await uniformsRouter.request(
      `/reports/sales?schoolId=${schoolId}&from=${period}-01&to=${now.slice(0, 10)}`, { method: "GET" }
    );
    expect(rep.status).toBe(200);
    const report = (await rep.json()).data as {
      totals: { orderCount: number; studentCount: number; quantity: number; revenue: number };
      rows: Array<{ jenjang: string; size: string; orderCount: number; studentCount: number; quantity: number; revenue: number }>;
    };
    expect(report.totals.orderCount).toBe(3);
    expect(report.totals.studentCount).toBe(2);
    expect(report.totals.revenue).toBe(expectedRevenue);
    const kainRow = report.rows.find((r) => r.size === "—");
    expect(kainRow?.quantity).toBe(2);
    const mRow = report.rows.find((r) => r.size === "M");
    expect(mRow?.quantity).toBe(4);
    expect(report.rows.every((r) => r.jenjang === "sd")).toBe(true);

    const filtered = await uniformsRouter.request(
      `/reports/sales?schoolId=${schoolId}&from=${period}-01&to=${now.slice(0, 10)}&jenjang=sma`, { method: "GET" }
    );
    expect(((await filtered.json()).data.rows as unknown[]).length).toBe(0);

    const cl = await uniformsRouter.request("/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, period }),
    });
    expect(cl.status).toBe(201);
    const claim = (await cl.json()).data as { id: string; claimNumber: string; totalQty: number; totalAmount: number; status: string };
    expect(claim.claimNumber.startsWith("CLM-")).toBe(true);
    expect(claim.totalQty).toBe(5);
    expect(claim.totalAmount).toBe(expectedRevenue);

    const dup = await uniformsRouter.request("/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, period }),
    });
    expect(dup.status).toBe(400);

    const lock = await uniformsRouter.request(`/claims/${claim.id}/lock`, { method: "POST" });
    expect(lock.status).toBe(200);
    expect((await lock.json()).data.status).toBe("locked");
    const lockAgain = await uniformsRouter.request(`/claims/${claim.id}/lock`, { method: "POST" });
    expect(lockAgain.status).toBe(400);

    mockActor("branch_admin", schoolId);
    const branchClaims = await uniformsRouter.request(`/claims?schoolId=${schoolId}`, { method: "GET" });
    expect(branchClaims.status).toBe(200);
    expect(((await branchClaims.json()).data as unknown[]).length).toBe(1);
  });

  it("input ongkir seragam oleh gudang + tolak alamat tanpa RT/RW/kode pos", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-uship-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Uship", code: `ALW-USHIP-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-uship-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-USHIP-${stamp}`, name: "Siswa Uship",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    const badOrder = await submitUniformOrder(db, {
      studentId, academicYear: "2026/2027",
      homeAddress: "Jl. Mawar No. 10, Bogor",
      items: [],
    });
    expect(badOrder.ok).toBe(false);
    const kainRes = await postJson("/variants", {
      code: `UK-USHIP-${stamp}`, name: "Kain Uship", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 50000,
    });
    expect(kainRes.status).toBe(201);
    const kainId = (await kainRes.json()).data.variant.id;
    await db.update(uniformStock).set({ quantity: 5, updatedAt: now }).where(eq(uniformStock.variantId, kainId));
    await seedPriorUniformOrder(schoolId, studentId, `uship-${stamp}`);
    const goodOrder = await submitUniformOrder(db, {
      studentId, academicYear: "2026/2027",
      homeAddress: "Jl. Melati RT 02 RW 04, Serpong, 15310",
      items: [{ variantId: kainId, quantity: 1 }],
    });
    expect(goodOrder.ok).toBe(true);
    if (!goodOrder.ok) return;
    const orderId = goodOrder.data.order.id;
    const badCost = await postJson(`/orders/${orderId}/shipping`, { shippingCost: -100 });
    expect(badCost.status).toBe(400);
    const okCost = await postJson(`/orders/${orderId}/shipping`, { shippingCost: 20000, shippingResi: "SRM-1" });
    expect(okCost.status).toBe(200);
    expect((await okCost.json()).data.shippingCost).toBe(20000);
    const shipRes = await uniformsRouter.request(`/orders/${orderId}/ship`, { method: "POST" });
    expect(shipRes.status).toBe(200);
    const [flagged] = await db.select().from(students).where(eq(students.id, studentId));
    expect(flagged.hasTakenUniform).toBe(true);
    await db.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
    await db.delete(students).where(eq(students.id, studentId));
    await db.delete(schools).where(eq(schools.id, schoolId));
  });

  it("invoice seragam wajib ongkir; konfirmasi bertahap lalu lunas via link", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-uinv-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Uinv", code: `ALW-UINV-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-uinv-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-UINV-${stamp}`, name: "Siswa Uinv",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", parentName: "Ortu", parentPhone: "+628130000001",
      createdAt: now, updatedAt: now,
    });
    const kainRes = await postJson("/variants", {
      code: `UK-UINV-${stamp}`, name: "Kain Uinv", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 50000,
    });
    expect(kainRes.status).toBe(201);
    const kainId = (await kainRes.json()).data.variant.id;
    await db.update(uniformStock).set({ quantity: 5, updatedAt: now }).where(eq(uniformStock.variantId, kainId));
    await seedPriorUniformOrder(schoolId, studentId, `uinv-${stamp}`);
    const goodOrder = await submitUniformOrder(db, {
      studentId, academicYear: "2026/2027",
      homeAddress: "Jl. Uinv RT 01 RW 01, Serpong 15310",
      items: [{ variantId: kainId, quantity: 1 }],
    });
    expect(goodOrder.ok).toBe(true);
    if (!goodOrder.ok) return;
    const orderId = goodOrder.data.order.id;
    const { publicUniformOrdersRouter } = await import("./public-uniform-orders");
    const lookupPublic = (path: string, init?: RequestInit) => publicUniformOrdersRouter.request(path, init);
    try {
      const blocked = await uniformsRouter.request(`/orders/${orderId}/send-invoice`, { method: "POST" });
      expect(blocked.status).toBe(400);

      const ship = await postJson(`/orders/${orderId}/shipping`, { shippingCost: 15000 });
      expect(ship.status).toBe(200);
      const sent = await uniformsRouter.request(`/orders/${orderId}/send-invoice`, { method: "POST" });
      expect(sent.status).toBe(200);
      const token = ((await sent.json()).data.confirmUrl as string).split("/").pop() as string;

      const lookup = await lookupPublic(`/confirm/${token}`, { method: "GET" });
      expect(lookup.status).toBe(200);
      expect((await lookup.json()).data.due).toBe(65000);

      const first = await lookupPublic(`/confirm/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 30000, allocationAmount: 30000 }),
      });
      expect(first.status).toBe(201);
      expect((await first.json()).data.paymentStatus).toBe("unpaid");

      const second = await lookupPublic(`/confirm/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 35000, allocationAmount: 35000 }),
      });
      expect(second.status).toBe(201);
      expect((await second.json()).data.paymentStatus).toBe("unpaid");

      // Uang baru sah setelah gudang memverifikasi tiap klaim.
      const claims = await selectReceiptsForOrder(orderId);
      const claimOne = claims.find((row) => row.allocation.amount === 30000)?.receipt;
      const claimTwo = claims.find((row) => row.allocation.amount === 35000)?.receipt;
      if (!claimOne || !claimTwo) throw new Error("klaim pembayaran tidak terbentuk");
      const verifyOne = await uniformsRouter.request(`/orders/${orderId}/payments/${claimOne.id}/verify`, { method: "POST" });
      expect(verifyOne.status).toBe(200);
      const verifyOneJson = await verifyOne.json();
      expect(verifyOneJson.data.paymentStatus).toBe("partial");
      expect(verifyOneJson.data.notification).toBeNull();
      const verifyTwo = await uniformsRouter.request(`/orders/${orderId}/payments/${claimTwo.id}/verify`, { method: "POST" });
      expect(verifyTwo.status).toBe(200);
      const verifyTwoJson = await verifyTwo.json();
      expect(verifyTwoJson.data.paymentStatus).toBe("paid");
      expect(verifyTwoJson.data.notification.wa.success).toBe(true);
    } finally {
      await deleteReceiptsForOrders([orderId]);
      await db.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("Aturan seragam: wajib paket pertama + toggle satuan + beasiswa", () => {
  it("murid baru tanpa paket ditolak satuan-only; toggle off menutup satuan", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-urule-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Rule", code: `ALW-RULE-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-rule-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-RULE-${stamp}`, name: "Siswa Rule",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    const kainRes = await postJson("/variants", {
      code: `UK-RULE-${stamp}`, name: "Kain Rule", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 50000,
    });
    expect(kainRes.status).toBe(201);
    const kainId = (await kainRes.json()).data.variant.id;
    await db.update(uniformStock).set({ quantity: 5, updatedAt: now }).where(eq(uniformStock.variantId, kainId));
    const addr = "Jl. Rule RT 01 RW 01, Serpong 15310";

    const fresh = await submitUniformOrder(db, {
      studentId, academicYear: "2026/2027", homeAddress: addr, items: [{ variantId: kainId, quantity: 1 }],
    });
    expect(fresh.ok).toBe(false);
    if (fresh.ok) return;
    expect(fresh.message).toMatch(/wajib membeli paket/i);

    await seedPriorUniformOrder(schoolId, studentId, `rule-${stamp}`);
    await db.insert(systemSettings).values({ key: "uniform_satuan_enabled", value: "false", updatedAt: now });
    try {
      const closed = await submitUniformOrder(db, {
        studentId, academicYear: "2026/2027", homeAddress: addr, items: [{ variantId: kainId, quantity: 1 }],
      });
      expect(closed.ok).toBe(false);
      if (closed.ok) return;
      expect(closed.message).toMatch(/ditutup/i);
    } finally {
      await db.delete(systemSettings).where(eq(systemSettings.key, "uniform_satuan_enabled"));
    }

    const noProof = await submitUniformOrder(db, {
      studentId, academicYear: "2026/2027", homeAddress: addr,
      items: [{ variantId: kainId, quantity: 1 }],
      orderType: "scholarship",
    });
    expect(noProof.ok).toBe(false);

    const scholar = await submitUniformOrder(db, {
      studentId, academicYear: "2026/2027", homeAddress: addr,
      items: [{ variantId: kainId, quantity: 1 }],
      orderType: "scholarship", scholarshipProofBase64: "data:image/jpeg;base64,dGVzdA==",
    });
    expect(scholar.ok).toBe(true);
    if (!scholar.ok) return;
    expect(scholar.data.order.totalAmount).toBe(0);
    expect(scholar.data.order.paymentStatus).toBe("scholarship_pending");

    await db.delete(students).where(eq(students.id, studentId));
    await db.delete(schools).where(eq(schools.id, schoolId));
  });

  it("beasiswa paket: total 0, approve melunaskan", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-usch-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Sch", code: `ALW-SCH-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-sch-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-SCH-${stamp}`, name: "Siswa Sch",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    const kainRes = await postJson("/variants", {
      code: `UK-SCH-${stamp}`, name: "Kain Sch", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 50000,
    });
    const kainId = (await kainRes.json()).data.variant.id;
    await db.update(uniformStock).set({ quantity: 5, updatedAt: now }).where(eq(uniformStock.variantId, kainId));
    const pkgRes = await postJson("/packages", {
      code: `UPK-SCH-${stamp}`, name: "Paket Sch", academicYear: "2026/2027",
      items: [{ variantId: kainId }],
    });
    expect(pkgRes.status).toBe(201);
    const pkgId = (await pkgRes.json()).data.id as string;
    const asm = await postJson(`/packages/${pkgId}/assemble`, { quantity: 2 });
    expect(asm.status).toBe(200);
    const created = await submitUniformOrder(db, {
      studentId, academicYear: "2026/2027",
      homeAddress: "Jl. Sch RT 01 RW 01, Serpong 15310",
      items: [{ packageId: pkgId, quantity: 1 }],
      orderType: "scholarship", scholarshipProofBase64: "data:image/jpeg;base64,dGVzdA==",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.order.totalAmount).toBe(0);
    expect(created.data.order.paymentStatus).toBe("scholarship_pending");
    const { uniformBatchRouter } = await import("./uniform-batch");
    const res = await uniformBatchRouter.request(`/orders/${created.data.order.id}/scholarship`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.paymentStatus).toBe("paid");
    await db.delete(students).where(eq(students.id, studentId));
    await db.delete(schools).where(eq(schools.id, schoolId));
  });
});
