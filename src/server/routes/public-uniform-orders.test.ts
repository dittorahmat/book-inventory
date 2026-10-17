import { describe, expect, it } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";
import { publicUniformOrdersRouter } from "./public-uniform-orders";
import { uniformsRouter } from "./uniforms";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { schools, students, suppliers, uniformVariants, uniformSizes, uniformStock, uniformOrders } from "../../db/schema";

const postStaff = async (path: string, body: unknown) => {
  mockActor("central_admin", null);
  try {
    return await uniformsRouter.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    restoreActor();
  }
};

const postPublic = (path: string, body: unknown) =>
  publicUniformOrdersRouter.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function seedSchoolStudent(stamp: string, uuidIds = false) {
  const now = new Date().toISOString();
  const schoolId = uuidIds ? crypto.randomUUID() : `sch-u-${stamp}`;
  await db.insert(schools).values({
    id: schoolId, name: `Al Wildan U-${stamp}`, code: `ALWU-${stamp}`, type: "branch", createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
  const studentId = uuidIds ? crypto.randomUUID() : `stu-u-${stamp}`;
  await db.insert(students).values({
    id: studentId, schoolId, nis: `NIS-U-${stamp}`, name: `Murid Seragam ${stamp}`, gender: "male",
    gradeLevel: "2", curriculumType: "international", academicYear: "2026/2027",
    parentName: "Ortu", parentPhone: "081234567890", status: "active", createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
  await db.insert(students).values({
    id: uuidIds ? crypto.randomUUID() : `stu-pending-${stamp}`, schoolId, nis: `NIS-P-${stamp}`,
    name: `Pending ${stamp}`, gender: "female", gradeLevel: "1", curriculumType: "national",
    academicYear: "2026/2027", parentName: "Ortu", parentPhone: "081234567891",
    status: "new_pending", createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
  return { schoolId, studentId };
}

async function seedCatalog(stamp: string) {
  const now = new Date().toISOString();
  const supplierId = `sup-uo-${stamp}`;
  await db.insert(suppliers).values({
    id: supplierId, name: "Konveksi Portal", code: `KONV-P-${stamp}`, createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
  const kain = await postStaff("/variants", {
    code: `UK-P-${stamp}`, name: "Kain Harian SD L", kind: "kain_harian",
    gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 120000,
  });
  expect(kain.status).toBe(201);
  const kainId = (await kain.json()).data.variant.id;
  const ol = await postStaff("/variants", {
    code: `UO-P-${stamp}`, name: "Olahraga SD L", kind: "olahraga",
    gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 95000,
    sizeChartUrl: "https://contoh.id/size-sd.png", sizes: ["S", "M"],
  });
  expect(ol.status).toBe(201);
  const olId = (await ol.json()).data.variant.id;
  const po = await postStaff("/pos", {
    supplierId,
    lines: [
      { variantId: kainId, quantityOrdered: 20, unitPrice: 120000 },
      { variantId: olId, size: "M", quantityOrdered: 20, unitPrice: 95000 },
    ],
  });
  expect(po.status).toBe(201);
  const recv = await postStaff(`/pos/${(await po.json()).data.id}/receive`, {
    lines: [{ variantId: kainId, quantity: 20 }, { variantId: olId, size: "M", quantity: 20 }],
  });
  expect(recv.status).toBe(200);
  const pkg = await postStaff("/packages", {
    code: `UPK-P-${stamp}`, name: "Paket Seragam SD L", academicYear: "2026/2027", price: 215000,
    items: [{ variantId: kainId }, { variantId: olId }],
  });
  expect(pkg.status).toBe(201);
  const pkgId = (await pkg.json()).data.id;
  const asm = await postStaff(`/packages/${pkgId}/assemble`, { quantity: 5, sizeOverrides: { [olId]: "M" } });
  expect(asm.status).toBe(200);
  return { kainId, olId, pkgId };
}

async function seedPriorOrder(schoolId: string, studentId: string, stamp: string) {
  const now = new Date().toISOString();
  await db.insert(uniformOrders).values({
    id: `uord-prior-${stamp}`, orderNumber: `USO-PRIOR-${stamp}`,
    studentId, schoolId, academicYear: "2026/2027",
    homeAddressSnapshot: "Jl. Prior RT 01 RW 01, Depok 16411",
    shipmentStatus: "sudah_dikirim", shippedAt: now,
    totalAmount: 215000, paidAmount: 215000,
    createdAt: "2020-01-01T00:00:00.000Z", updatedAt: now,
  });
}

describe("Portal seragam publik", () => {
  it("search wajib sekolah, min 2 char, sembunyikan pending", async () => {
    const stamp = `s${Date.now()}`;
    const { schoolId } = await seedSchoolStudent(stamp);
    const ok = await publicUniformOrdersRouter.request(
      `/search-students?query=${encodeURIComponent(`Seragam ${stamp}`)}&schoolId=${schoolId}`, { method: "GET" }
    );
    expect(ok.status).toBe(200);
    const names = ((await ok.json()).data as Array<{ name: string; status: string }>).map((s) => s.name);
    expect(names.some((n) => n.includes(stamp) && !n.startsWith("Pending"))).toBe(true);
    expect(names.some((n) => n.startsWith("Pending"))).toBe(false);
    const noSchool = await publicUniformOrdersRouter.request("/search-students?query=ab", { method: "GET" });
    expect(noSchool.status).toBe(400);
  });

  it("search seragam mengembalikan subset kolom yang sama persis (tanpa bocor eligibility buku)", async () => {
    const stamp = `w${Date.now()}`;
    const { schoolId } = await seedSchoolStudent(stamp);
    const ok = await publicUniformOrdersRouter.request(
      `/search-students?query=${encodeURIComponent(`Seragam ${stamp}`)}&schoolId=${schoolId}`, { method: "GET" }
    );
    expect(ok.status).toBe(200);
    const rows = (await ok.json()).data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    const whitelist = ["id", "nis", "name", "gender", "gradeLevel", "academicYear", "status", "schoolId", "schoolName", "parentName", "parentPhone"].sort();
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(whitelist);
    }
  });

  it("katalog per tahun ajaran memuat size chart", async () => {
    const stamp = `k${Date.now()}`;
    await seedCatalog(stamp);
    const res = await publicUniformOrdersRouter.request("/catalog?academicYear=2026%2F2027", { method: "GET" });
    expect(res.status).toBe(200);
    const catalog = await res.json();
    const ol = (catalog.data.variants as Array<{ code: string; sizes: string[]; sizeChartUrl: string | null }>).find(
      (v) => v.code === `UO-P-${stamp}`
    );
    expect(ol?.sizes).toEqual(["S", "M"]);
    expect(ol?.sizeChartUrl).toBe("https://contoh.id/size-sd.png");
  });

  it("submit satuan + paket; beli 2x = 2 order 1 murid", async () => {
    const stamp = `o${Date.now()}`;
    const { schoolId, studentId } = await seedSchoolStudent(stamp);
    const { kainId, olId, pkgId } = await seedCatalog(stamp);
    const addr = "Jl. Merdeka No. 45, RT 02 RW 05, Depok, Jawa Barat 16418";
    await seedPriorOrder(schoolId, studentId, stamp);

    const short = await postPublic("/orders", {
      studentId, academicYear: "2026/2027", homeAddress: "Jl. X", items: [{ variantId: kainId }],
    });
    expect(short.status).toBe(400);

    const first = await postPublic("/orders", {
      studentId, academicYear: "2026/2027", homeAddress: addr, items: [{ variantId: kainId, quantity: 1 }],
    });
    expect(first.status).toBe(201);
    const firstNo = (await first.json()).data.order.orderNumber as string;
    // Sengaja agnostik prefix (default USO, customizable via settings):
    // assertion literal "USO-" rapuh terhadap test lain yang memutar prefix.
    expect(/^[A-Z0-9-]+-/.test(firstNo)).toBe(true);

    const noSize = await postPublic("/orders", {
      studentId, academicYear: "2026/2027", homeAddress: addr, items: [{ packageId: pkgId }],
    });
    expect(noSize.status).toBe(400);

    const second = await postPublic("/orders", {
      studentId, academicYear: "2026/2027", homeAddress: addr,
      items: [{ packageId: pkgId, quantity: 1 }],
      sizeOverrides: { [olId]: "M" },
    });
    expect(second.status).toBe(201);
    expect((await second.json()).data.order.shipmentStatus).toBe("belum_dikirim");

    const lookup = await publicUniformOrdersRouter.request(
      `/lookup-order?orderNumber=${encodeURIComponent(firstNo.slice(0, 12))}&schoolId=${schoolId}`, { method: "GET" }
    );
    expect(lookup.status).toBe(200);
    const orders = (await lookup.json()).data.orders as Array<{ studentId: string }>;
    expect(orders.length).toBe(2);
    expect(new Set(orders.map((o) => o.studentId)).size).toBe(1);
  });

  it("payload ID format UUID juga lolos", async () => {
    const stamp = `u${Date.now()}`;
    const { schoolId, studentId } = await seedSchoolStudent(stamp, true);
    const now = new Date().toISOString();
    const vid = crypto.randomUUID();
    await db.insert(uniformVariants).values({
      id: vid, code: `UV-UUID-${stamp}`, name: "Kain UUID", kind: "kain_harian",
      gender: "female", jenjang: "sd", academicYear: "2026/2027", price: 110000, createdAt: now, updatedAt: now,
    });
    await db.insert(uniformStock).values({ id: crypto.randomUUID(), variantId: vid, size: "—", quantity: 5, updatedAt: now });
    await seedPriorOrder(schoolId, studentId, stamp);
    const res = await postPublic("/orders", {
      studentId, academicYear: "2026/2027",
      homeAddress: "Jl. Anggrek No. 7, RT 01 RW 03, Jakarta Selatan 12510",
      items: [{ variantId: vid, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    expect((await res.json()).data.totalAmount).toBe(110000);
  });

  it("order 30 baris satuan sekaligus lolos (chunked, §10)", async () => {
    const stamp = `v${Date.now()}`;
    const { schoolId, studentId } = await seedSchoolStudent(stamp);
    await seedPriorOrder(schoolId, studentId, stamp);
    const now = new Date().toISOString();
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      const vid = `uv-uo-vol-${stamp}-${i}`;
      ids.push(vid);
      await db.insert(uniformVariants).values({
        id: vid, code: `UV-VOL-${stamp}-${i}`, name: `Kain Vol ${i}`, kind: "kain_harian",
        gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 40000 + i, createdAt: now, updatedAt: now,
      });
      await db.insert(uniformStock).values({ id: `ust-uo-vol-${stamp}-${i}`, variantId: vid, size: "—", quantity: 5, updatedAt: now });
    }
    const res = await postPublic("/orders", {
      studentId, academicYear: "2026/2027",
      homeAddress: "Jl. Volume No. 30, RT 04 RW 02, Bogor, Jawa Barat 16111",
      items: ids.map((variantId) => ({ variantId, quantity: 1 })),
    });
    expect(res.status).toBe(201);
    const [created] = await db.select().from(uniformOrders).where(
      eq(uniformOrders.id, (await res.json()).data.order.id)
    );
    expect(created.paidAmount).toBe(0);
    expect(created.paymentStatus).toBe("unpaid");
  });
});

describe("Portal retur seragam mandiri", () => {
  it("lookup by murid, ajukan tukar & refund, tolak milik orang lain", async () => {
    const stamp = `r${Date.now()}`;
    const { schoolId, studentId } = await seedSchoolStudent(stamp);
    const now = new Date().toISOString();
    const otherId = `stu-other-${stamp}`;
    await db.insert(students).values({
      id: otherId, schoolId, nis: `NIS-O-${stamp}`, name: `Anak Lain ${stamp}`, gender: "male",
      gradeLevel: "2", curriculumType: "international", academicYear: "2026/2027",
      parentName: "Ortu", parentPhone: "081299999999", status: "active", createdAt: now, updatedAt: now,
    });
    const vid = `uv-ret-${stamp}`;
    await db.insert(uniformVariants).values({
      id: vid, code: `UV-RET-${stamp}`, name: "Olahraga Retur", kind: "olahraga",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 95000, createdAt: now, updatedAt: now,
    });
    await db.insert(uniformSizes).values({ id: `us-ret-s-${stamp}`, variantId: vid, size: "S", sortOrder: 0, createdAt: now });
    await db.insert(uniformSizes).values({ id: `us-ret-m-${stamp}`, variantId: vid, size: "M", sortOrder: 1, createdAt: now });
    await db.insert(uniformStock).values({ id: `ust-ret-s-${stamp}`, variantId: vid, size: "S", quantity: 4, updatedAt: now });
    await db.insert(uniformStock).values({ id: `ust-ret-m-${stamp}`, variantId: vid, size: "M", quantity: 4, updatedAt: now });
    await seedPriorOrder(schoolId, studentId, stamp);

    const orderRes = await postPublic("/orders", {
      studentId, academicYear: "2026/2027",
      homeAddress: "Jl. Retur No. 5, RT 01 RW 02, Depok 16414",
      items: [{ variantId: vid, size: "S", quantity: 1 }],
    });
    expect(orderRes.status).toBe(201);
    const orderId = (await orderRes.json()).data.order.id as string;

    const lookup = await publicUniformOrdersRouter.request(
      `/lookup-order?studentId=${studentId}&schoolId=${schoolId}`, { method: "GET" }
    );
    expect(lookup.status).toBe(200);
    const found = await lookup.json();
    const foundOrders = found.data.orders as Array<{ id: string }>;
    expect(foundOrders.some((o) => o.id === orderId)).toBe(true);
    expect(Object.keys(found.data.itemsByOrder as Record<string, unknown[]>)).toContain(orderId);

    const empty = await publicUniformOrdersRouter.request(`/lookup-order?schoolId=${schoolId}`, { method: "GET" });
    expect(empty.status).toBe(400);

    const exchange = await postPublic("/exchange-requests", {
      orderId, studentId, oldVariantId: vid, oldSize: "S", newVariantId: vid, newSize: "M", reason: "Kekecilan",
    });
    expect(exchange.status).toBe(201);

    const cross = await postPublic("/exchange-requests", {
      orderId, studentId: otherId, oldVariantId: vid, oldSize: "S", newVariantId: vid, newSize: "M", reason: "Iseng",
    });
    expect(cross.status).toBe(403);

    const refund = await postPublic("/refund-requests", {
      orderId, studentId, amount: 50000, reason: "Jahitan lepas",
    });
    expect(refund.status).toBe(201);

    const over = await postPublic("/refund-requests", {
      orderId, studentId, amount: 999999999, reason: "Serakah",
    });
    expect(over.status).toBe(400);
  });
});
