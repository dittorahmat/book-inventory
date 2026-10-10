import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { bookItems, bookPackages, books, packageItems, schools } from "../../db/schema";
import { stockSummaryRouter } from "./stock-summary";
import { shipmentsRouter } from "./shipments";
import { getLooseStockSummary, getPackageStockSummary } from "../services/stock-summary";
import { allocateLooseStock, resolveShipmentLines } from "../services/stock-allocation";

const iso = (offsetMinutes: number) =>
  new Date(Date.now() + offsetMinutes * 60_000).toISOString();

async function seedLocation(prefix: string) {
  const id = `loc-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await db.insert(schools).values({
    id,
    name: `Lokasi ${prefix}`,
    code: `LOC-${prefix}-${Date.now()}`,
    type: "branch",
    createdAt: iso(0),
    updatedAt: iso(0),
  });
  return id;
}

async function seedBook(prefix: string, sellPrice: number) {
  const id = `bk-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await db.insert(books).values({
    id,
    isbn: `ISBN-${prefix}-${Date.now()}`,
    title: `Judul ${prefix}`,
    author: "Tester",
    publisher: "Test",
    price: sellPrice,
    sellPrice,
    buyPrice: Math.max(1, sellPrice - 1000),
    createdAt: iso(0),
    updatedAt: iso(0),
  });
  return id;
}

/** Seed eksemplar fisik dengan createdAt bertingkat agar urutan FIFO bisa diuji. */
async function seedLooseCopies(input: {
  bookId: string;
  schoolId: string;
  count: number;
  condition?: "new" | "good" | "fair" | "damaged";
}) {
  const ids: string[] = [];
  for (let i = 0; i < input.count; i++) {
    const id = `bi-${input.bookId}-${input.schoolId}-${i}-${Date.now()}`;
    await db.insert(bookItems).values({
      id,
      bookId: input.bookId,
      currentSchoolId: input.schoolId,
      barcode: `BC-${id}`,
      condition: input.condition ?? "new",
      status: "in_stock",
      createdAt: iso(i),
      updatedAt: iso(i),
    });
    ids.push(id);
  }
  return ids;
}

async function seedPackage(prefix: string) {
  const id = `pk-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await db.insert(bookPackages).values({
    id,
    code: `PKG-${prefix}-${Date.now()}`,
    name: `Paket ${prefix}`,
    gradeLevel: "1",
    curriculumType: "international",
    academicYear: "2026/2027",
    price: 500000,
    createdAt: iso(0),
    updatedAt: iso(0),
  });
  return id;
}

async function seedBundles(packageId: string, schoolId: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `pi-${packageId}-${schoolId}-${i}-${Date.now()}`;
    await db.insert(packageItems).values({
      id,
      packageId,
      currentSchoolId: schoolId,
      barcode: `PB-${id}`,
      status: "in_stock",
      createdAt: iso(i),
      updatedAt: iso(i),
    });
    ids.push(id);
  }
  return ids;
}

describe("Agregasi stok per judul & per paket (spec: inventory-summary)", () => {
  it("menghasilkan satu baris per judul dengan total sama dengan penjumlahan row fisik", async () => {
    const locationId = await seedLocation("sumloose");
    const bookA = await seedBook("sumA", 30000);
    const bookB = await seedBook("sumB", 45000);

    await seedLooseCopies({ bookId: bookA, schoolId: locationId, count: 3 });
    await seedLooseCopies({ bookId: bookB, schoolId: locationId, count: 2, condition: "good" });

    const rows = await getLooseStockSummary([locationId]);
    const rowA = rows.find((r) => r.bookId === bookA);
    const rowB = rows.find((r) => r.bookId === bookB);

    expect(rows.filter((r) => r.bookId === bookA)).toHaveLength(1);
    expect(rowA?.totalQty).toBe(3);
    expect(rowA?.availableQty).toBe(3);
    expect(rowA?.byCondition.new).toBe(3);
    expect(rowB?.totalQty).toBe(2);
    expect(rowB?.byCondition.good).toBe(2);

    // Jumlah baris fisik = jumlah SUMMARY
    const physical = await db
      .select({ id: bookItems.id })
      .from(bookItems)
      .where(eq(bookItems.currentSchoolId, locationId));
    expect(physical).toHaveLength(5);
    const totalFromSummary = rows.reduce((s, r) => s + r.totalQty, 0);
    expect(totalFromSummary).toBe(physical.length);

    // Baris summary tidak membawa barcode fisik
    expect(Object.keys(rowA ?? {})).not.toContain("barcode");

    await db.delete(bookItems).where(eq(bookItems.currentSchoolId, locationId));
    await db.delete(books).where(eq(books.id, bookA));
    await db.delete(books).where(eq(books.id, bookB));
    await db.delete(schools).where(eq(schools.id, locationId));
  });

  it("menghasilkan satu baris per jenis paket dengan total sama dengan jumlah bundel fisik", async () => {
    const locationId = await seedLocation("sumpkg");
    const packageId = await seedPackage("sum");
    await seedBundles(packageId, locationId, 4);

    const rows = await getPackageStockSummary([locationId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].packageId).toBe(packageId);
    expect(rows[0].totalQty).toBe(4);
    expect(rows[0].readyQty).toBe(4);
    expect(rows[0].byStatus.in_stock).toBe(4);
    expect(Object.keys(rows[0])).not.toContain("barcode");

    await db.delete(packageItems).where(eq(packageItems.currentSchoolId, locationId));
    await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
    await db.delete(schools).where(eq(schools.id, locationId));
  });

  it("endpoint summary mengembalikan barag per judul untuk satu lokasi", async () => {
    const locationId = await seedLocation("epssum");
    const bookId = await seedBook("eps", 25000);
    await seedLooseCopies({ bookId, schoolId: locationId, count: 2 });

    const res = await stockSummaryRouter.request(`/loose?schoolId=${locationId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const row = json.data.find((r: any) => r.bookId === bookId);
    expect(row.totalQty).toBe(2);
    expect(row.schoolId).toBe(locationId);

    const overview = await stockSummaryRouter.request(`/overview?schoolId=${locationId}`);
    const overviewJson = await overview.json();
    const loc = overviewJson.data.find((r: any) => r.schoolId === locationId);
    expect(loc.looseTotalQty).toBe(2);
    expect(loc.loose.length).toBeGreaterThan(0);

    await db.delete(bookItems).where(eq(bookItems.currentSchoolId, locationId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, locationId));
  });
});

describe("Alokasi FIFO berbasis kuantitas (spec: inventory-summary)", () => {
  it("transfer 10 kuantitas mengalokasikan 10 eksemplar fisik tertua", async () => {
    const from = await seedLocation("fifoFrom");
    const to = await seedLocation("fifoTo");
    const bookId = await seedBook("fifo", 50000);
    const seeded = await seedLooseCopies({ bookId, schoolId: from, count: 12 });

    const res = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: from,
        toSchoolId: to,
        items: [{ itemType: "loose", bookId, quantity: 10 }],
      }),
    });
    expect(res.status).toBe(201);
    const shipmentId = (await res.json()).data.id;

    const detail = await shipmentsRouter.request(`/${shipmentId}`);
    const detailJson = await detail.json();
    const itemIds = detailJson.data.items
      .filter((i: any) => i.itemType === "loose")
      .map((i: any) => i.bookItemId);

    expect(itemIds).toHaveLength(10);
    // 10 eksemplar tertua = 10 pertama dari 12 yang di-seed
    expect(new Set(itemIds)).toEqual(new Set(seeded.slice(0, 10)));

    await db.delete(bookItems).where(eq(bookItems.currentSchoolId, from));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, from));
    await db.delete(schools).where(eq(schools.id, to));
  });

  it("satu surat jalan dapat memuat banyak jenis paket sekaligus", async () => {
    const from = await seedLocation("multiFrom");
    const to = await seedLocation("multiTo");
    const pkgA = await seedPackage("multiA");
    const pkgB = await seedPackage("multiB");
    await seedBundles(pkgA, from, 3);
    await seedBundles(pkgB, from, 2);

    const res = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: from,
        toSchoolId: to,
        items: [
          { itemType: "package", packageId: pkgA, quantity: 2 },
          { itemType: "package", packageId: pkgB, quantity: 1 },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const shipmentId = (await res.json()).data.id;

    const detail = await shipmentsRouter.request(`/${shipmentId}`);
    const items = (await detail.json()).data.items;
    const pkgRows = items.filter((i: any) => i.itemType === "package");
    expect(pkgRows).toHaveLength(3);
    expect(new Set(pkgRows.map((i: any) => i.packageId))).toEqual(new Set([pkgA, pkgB]));

    await db.delete(packageItems).where(eq(packageItems.currentSchoolId, from));
    await db.delete(bookPackages).where(eq(bookPackages.id, pkgA));
    await db.delete(bookPackages).where(eq(bookPackages.id, pkgB));
    await db.delete(schools).where(eq(schools.id, from));
    await db.delete(schools).where(eq(schools.id, to));
  });

  it("menolak kuantitas melebihi stok tersedia", async () => {
    const from = await seedLocation("shortFrom");
    const to = await seedLocation("shortTo");
    const bookId = await seedBook("short", 40000);
    await seedLooseCopies({ bookId, schoolId: from, count: 3 });

    const res = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: from,
        toSchoolId: to,
        items: [{ itemType: "loose", bookId, quantity: 5 }],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/tidak cukup/i);

    await db.delete(bookItems).where(eq(bookItems.currentSchoolId, from));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, from));
    await db.delete(schools).where(eq(schools.id, to));
  });

  it("alokasi hanya mengambil kondisi new dan good", async () => {
    const locationId = await seedLocation("condLoc");
    const bookId = await seedBook("cond", 35000);
    await seedLooseCopies({ bookId, schoolId: locationId, count: 2, condition: "damaged" });
    const good = await seedLooseCopies({ bookId, schoolId: locationId, count: 3, condition: "good" });

    const result = await allocateLooseStock({ bookId, schoolId: locationId, quantity: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items.map((i) => i.id)).toEqual(good);
    }

    // Butuh 4 (2 rusak + 3 baik) -> hanya 3 yang boleh dialokasikan
    const tooMany = await allocateLooseStock({ bookId, schoolId: locationId, quantity: 4 });
    expect(tooMany.ok).toBe(false);

    await db.delete(bookItems).where(eq(bookItems.currentSchoolId, locationId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, locationId));
  });

  it("resolveShipmentLines menggabungkan satuan dan paket dalam satu resolution", async () => {
    const from = await seedLocation("comboFrom");
    const bookId = await seedBook("combo", 20000);
    const pkgId = await seedPackage("combo");
    await seedLooseCopies({ bookId, schoolId: from, count: 4 });
    await seedBundles(pkgId, from, 2);

    const result = await resolveShipmentLines(from, [
      { itemType: "loose", bookId, quantity: 3 },
      { itemType: "package", packageId: pkgId, quantity: 1 },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.looseIds).toHaveLength(3);
      expect(result.bundleIds).toHaveLength(1);
    }

    await db.delete(packageItems).where(eq(packageItems.currentSchoolId, from));
    await db.delete(bookItems).where(eq(bookItems.currentSchoolId, from));
    await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, from));
  });
});

describe("Status satuan tidak berubah karena bundling saat transfer paket (spec: inventory-summary)", () => {
  it("eksemplar satuan penyusun paket tetap disposed dan tidak berpindah lokasi", async () => {
    const from = await seedLocation("bundleFrom");
    const to = await seedLocation("bundleTo");
    const bookId = await seedBook("bundle", 60000);
    const looseIds = await seedLooseCopies({ bookId, schoolId: from, count: 5 });

    // Simulasikan hasil bundling: Loose satuan di-dispose dan ditandai sudah dibundel.
    const componentIds = looseIds.slice(0, 2);
    await db
      .update(bookItems)
      .set({ status: "disposed", notes: "Bundled into Paket Uji", updatedAt: iso(0) })
      .where(and(eq(bookItems.currentSchoolId, from), eq(bookItems.id, componentIds[0]!)))
      .then(async () => {
        await db
          .update(bookItems)
          .set({ status: "disposed", notes: "Bundled into Paket Uji", updatedAt: iso(0) })
          .where(and(eq(bookItems.currentSchoolId, from), eq(bookItems.id, componentIds[1]!)));
      });

    // Bundel fisik siap di.transfer.
    const packageId = await seedPackage("bundletransfer");
    const bundleIds = await seedBundles(packageId, from, 2);

    const before = await db.select().from(bookItems).where(eq(bookItems.id, componentIds[0]!));
    const beforeStatus = before[0]?.status;
    const beforeSchool = before[0]?.currentSchoolId;
    expect(beforeStatus).toBe("disposed");
    expect(beforeSchool).toBe(from);

    const createRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: from,
        toSchoolId: to,
        items: [{ itemType: "package", packageId, quantity: 2 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const shipmentId = (await createRes.json()).data.id;

    const dispatchRes = await shipmentsRouter.request(`/${shipmentId}/dispatch`, { method: "POST" });
    expect(dispatchRes.status).toBe(200);

    // Eksemplar satuan penyusun paket: status & lokasi TIDAK berubah.
    for (const componentId of componentIds) {
      const [row] = await db.select().from(bookItems).where(eq(bookItems.id, componentId));
      expect(row?.status).toBe("disposed");
      expect(row?.currentSchoolId).toBe(from);
    }

    // Yang berpindah adalah paketnya.
    const dispatchedBundles = await db
      .select()
      .from(packageItems)
      .where(eq(packageItems.id, bundleIds[0]!));
    expect(dispatchedBundles[0]?.status).toBe("dispatched");

    await db.delete(packageItems).where(eq(packageItems.currentSchoolId, from));
    await db.delete(bookItems).where(eq(bookItems.currentSchoolId, from));
    await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, from));
    await db.delete(schools).where(eq(schools.id, to));
  });
});
