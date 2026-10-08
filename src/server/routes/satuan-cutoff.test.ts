import { describe, expect, it, afterAll, afterEach } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  books,
  schools,
  students,
  studentBookOrders,
  studentOrderItems,
  systemSettings,
} from "../../db/schema";
import { auth } from "../auth";
import { publicOrdersRouter } from "./public-orders";
import { settingsRouter } from "./settings";
import {
  getSatuanStatus,
  openFromKey,
  overrideKey,
  setSatuanOpenFrom,
  setSatuanOverride,
} from "../services/satuan-cutoff";
import { currentAcademicYear, todayWIB } from "../../lib/wib-time";

const FUTURE_YEAR = "2099/2100";
const ROLLOVER_YEAR = "2098/2099";

const realGetSession = auth.api.getSession;
function actAs(
  role: "central_admin" | "warehouse_admin" | "school_admin" | null,
  schoolId: string | null = null
) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-cutoff-test", role, schoolId } } as any) : null;
}
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
});

async function clearSettings(year: string) {
  await db.delete(systemSettings).where(eq(systemSettings.key, openFromKey(year)));
  await db.delete(systemSettings).where(eq(systemSettings.key, overrideKey(year)));
}

async function seedVerifiedStudent(stamp: number) {
  const [location] = await db.select({ id: schools.id }).from(schools).limit(1);
  const schoolId = location?.id;
  if (!schoolId) throw new Error("Lokasi sekolah belum tersedia. Jalankan seed terlebih dahulu.");
  const id = `stu-satuan-${stamp}`;
  await db.insert(students).values({
    id,
    schoolId,
    nis: `NIS-SAT-${stamp}`,
    name: `Murid Satuan ${stamp}`,
    gender: "male",
    gradeLevel: "5",
    curriculumType: "international",
    academicYear: FUTURE_YEAR,
    parentName: "Orang Tua",
    parentEmail: `ortu${stamp}@example.com`,
    parentPhone: "08123456789",
    status: "active",
    isScholarship: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

async function seedBook(stamp: number, sellPrice: number) {
  const id = `bk-satuan-${stamp}-${Math.floor(Math.random() * 10000)}`;
  await db.insert(books).values({
    id,
    isbn: `ISBN-SAT-${stamp}-${Math.floor(Math.random() * 10000)}`,
    title: `Buku Satuan ${stamp}`,
    author: "Tester",
    publisher: "Test",
    price: sellPrice,
    sellPrice,
    buyPrice: Math.max(1, sellPrice - 5000),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

afterAll(async () => {
  await clearSettings(FUTURE_YEAR);
  await clearSettings(ROLLOVER_YEAR);
  await clearSettings(currentAcademicYear());
});

describe("Evaluasi cut-off satuan (spec: public-order-satuan)", () => {
  it("tertutup secara default bila tahun ajaran belum diatur", async () => {
    await clearSettings(FUTURE_YEAR);
    const status = await getSatuanStatus(FUTURE_YEAR);
    expect(status.open).toBe(false);
    expect(status.openFrom).toBeNull();
    expect(status.reason).toMatch(/belum dibuka/i);
  });

  it("terbuka pada atau setelah tanggal efektif, tertutup sebelum tanggal", async () => {
    const today = todayWIB();
    const todayMs = new Date(today + "T00:00:00Z").getTime();
    const yesterday = new Date(todayMs - 86_400_000).toISOString().slice(0, 10);
    const tomorrow = new Date(todayMs + 86_400_000).toISOString().slice(0, 10);

    await setSatuanOpenFrom(FUTURE_YEAR, yesterday);
    expect((await getSatuanStatus(FUTURE_YEAR)).open).toBe(true);

    await setSatuanOpenFrom(FUTURE_YEAR, tomorrow);
    const closed = await getSatuanStatus(FUTURE_YEAR);
    expect(closed.open).toBe(false);
    expect(closed.openFrom).toBe(tomorrow);
    expect(closed.reason).toContain(tomorrow);

    await clearSettings(FUTURE_YEAR);
  });

  it("override manual mengalahkan aturan tanggal dan dapat dihapus", async () => {
    await setSatuanOpenFrom(FUTURE_YEAR, "2090-01-01");
    expect((await getSatuanStatus(FUTURE_YEAR)).open).toBe(false);

    await setSatuanOverride(FUTURE_YEAR, "open");
    expect((await getSatuanStatus(FUTURE_YEAR)).open).toBe(true);

    await setSatuanOverride(FUTURE_YEAR, "closed");
    expect((await getSatuanStatus(FUTURE_YEAR)).open).toBe(false);

    await setSatuanOverride(FUTURE_YEAR, null);
    expect((await getSatuanStatus(FUTURE_YEAR)).override).toBeNull();

    await clearSettings(FUTURE_YEAR);
  });

  it("rollover Agustus: tahun ajaran baru otomatis tertutup meski WIB sudah berganti hari", async () => {
    await clearSettings(ROLLOVER_YEAR);
    // 1 Agustus 2098 WIB, tetapi UTC masih 31 Juli.
    const augustFirst = new Date("2098-07-31T18:00:00.000Z");
    expect(currentAcademicYear(augustFirst)).toBe(ROLLOVER_YEAR);

    const status = await getSatuanStatus(ROLLOVER_YEAR, augustFirst);
    expect(status.todayWIB).toBe("2098-08-01");
    expect(status.open).toBe(false);
  });
});

describe("Order satuan di portal publik (spec: public-order-satuan)", () => {
  it("menolak order satuan dan menyembunyikan katalog saat periode tertutup", async () => {
    const stamp = Date.now();
    const year = currentAcademicYear();
    await clearSettings(year);

    const studentId = await seedVerifiedStudent(stamp);
    const bookId = await seedBook(stamp, 45000);

    try {
      const catalog = await publicOrdersRouter.request("/satuan-catalog");
      const catalogJson = await catalog.json();
      expect(catalogJson.data.open).toBe(false);
      expect(catalogJson.data.books).toHaveLength(0);

      const res = await publicOrdersRouter.request("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, looseItems: [{ bookId, quantity: 1 }] }),
      });
      expect(res.status).toBe(403);
      expect((await res.json()).message).toMatch(/ditutup/i);
    } finally {
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookId));
    }
  });

  it("membuat order satuan dengan total jumlah harga jual saat periode dibuka", async () => {
    const stamp = Date.now();
    const year = currentAcademicYear();
    await clearSettings(year);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await setSatuanOpenFrom(year, yesterday);

    const studentId = await seedVerifiedStudent(stamp);
    const bookA = await seedBook(stamp, 45000);
    const bookB = await seedBook(stamp, 30000);
    const createdOrderIds: string[] = [];

    try {
      const catalog = await publicOrdersRouter.request("/satuan-catalog");
      const catalogJson = await catalog.json();
      expect(catalogJson.data.open).toBe(true);
      const listed = catalogJson.data.books.find((b: any) => b.id === bookA);
      expect(listed.sellPrice).toBe(45000);

      const res = await publicOrdersRouter.request("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          looseItems: [
            { bookId: bookA, quantity: 1 },
            { bookId: bookB, quantity: 1 },
          ],
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      const orderId: string = json.data.order.id;
      createdOrderIds.push(orderId);

      expect(json.data.totalAmount).toBe(75000);
      expect(json.data.packageName).toBeNull();
      expect(json.data.looseItems).toHaveLength(2);

      const [order] = await db
        .select()
        .from(studentBookOrders)
        .where(eq(studentBookOrders.id, orderId));
      expect(order.packageId).toBeNull();
      expect(order.totalAmount).toBe(75000);

      const lines: Array<{ quantity: number; unitPriceSnapshot: number }> = await db
        .select()
        .from(studentOrderItems)
        .where(eq(studentOrderItems.orderId, orderId));
      expect(lines).toHaveLength(2);
      expect(lines.reduce((s, l) => s + l.quantity * l.unitPriceSnapshot, 0)).toBe(75000);
    } finally {
      for (const id of createdOrderIds) {
        await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, id));
        await db.delete(studentBookOrders).where(eq(studentBookOrders.id, id));
      }
      await clearSettings(year);
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookA));
      await db.delete(books).where(eq(books.id, bookB));
    }
  });

  it("override tutup paksa menutup satuan walau tanggal efektif sudah lewat", async () => {
    const stamp = Date.now();
    const year = currentAcademicYear();
    await clearSettings(year);
    await setSatuanOpenFrom(year, new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
    await setSatuanOverride(year, "closed");

    const studentId = await seedVerifiedStudent(stamp);
    const bookId = await seedBook(stamp, 25000);

    try {
      const status = await publicOrdersRouter.request("/satuan-status");
      expect((await status.json()).data.open).toBe(false);

      const catalog = await publicOrdersRouter.request("/satuan-catalog");
      expect((await catalog.json()).data.books).toHaveLength(0);

      const res = await publicOrdersRouter.request("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, looseItems: [{ bookId, quantity: 2 }] }),
      });
      expect(res.status).toBe(403);
    } finally {
      await clearSettings(year);
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookId));
    }
  });
});

describe("Otorisasi pengaturan cut-off (spec: public-order-satuan)", () => {
  it("menolak admin sekolah saat membuka pengaturan cut-off", async () => {
    actAs("school_admin", "school-alw-2");

    const getRes = await settingsRouter.request("/satuan-cutoff", { method: "GET" });
    expect(getRes.status).toBe(403);

    const postRes = await settingsRouter.request("/satuan-cutoff/open-from", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear: FUTURE_YEAR, openFrom: "2026-08-01" }),
    });
    expect(postRes.status).toBe(403);

    const overrideRes = await settingsRouter.request("/satuan-cutoff/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear: FUTURE_YEAR, override: "open" }),
    });
    expect(overrideRes.status).toBe(403);
  });

  it("mengizinkan admin gudang menyimpan tanggal dan override", async () => {
    actAs("warehouse_admin", "school-warehouse");
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const dateRes = await settingsRouter.request("/satuan-cutoff/open-from", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear: FUTURE_YEAR, openFrom: yesterday }),
    });
    expect(dateRes.status).toBe(200);
    const dateJson = await dateRes.json();
    expect(dateJson.data.openFrom).toBe(yesterday);
    expect(dateJson.data.open).toBe(true);

    const overrideRes = await settingsRouter.request("/satuan-cutoff/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear: FUTURE_YEAR, override: "closed" }),
    });
    expect(overrideRes.status).toBe(200);
    expect((await overrideRes.json()).data.open).toBe(false);

    const getRes = await settingsRouter.request(`/satuan-cutoff?academicYear=${FUTURE_YEAR}`, {
      method: "GET",
    });
    expect((await getRes.json()).data.override).toBe("closed");

    await clearSettings(FUTURE_YEAR);
  });

  it("menolak format tahun ajaran, tanggal, dan override yang salah", async () => {
    actAs("central_admin");

    const badYear = await settingsRouter.request("/satuan-cutoff/open-from", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear: "2026", openFrom: "2026-08-01" }),
    });
    expect(badYear.status).toBe(400);

    const badDate = await settingsRouter.request("/satuan-cutoff/open-from", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear: "2026/2027", openFrom: "01-08-2026" }),
    });
    expect(badDate.status).toBe(400);

    const badOverride = await settingsRouter.request("/satuan-cutoff/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear: "2026/2027", override: "maybe" }),
    });
    expect(badOverride.status).toBe(400);
  });
});

describe("Katalog satuan terpadu cut-off (spec: c4-single-capability)", () => {
  it("mengembalikan katalog kosong saat tertutup dan harga efektif saat terbuka", async () => {
    const stamp = Date.now();
    const bookId = `bk-cat-${stamp}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-CAT-${stamp}`,
      title: `Buku Katalog ${stamp}`,
      author: "Tester",
      publisher: "Test",
      price: 80000,
      sellPrice: 0,
      buyPrice: 70000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    try {
      await clearSettings(FUTURE_YEAR);
      const closedRes = await publicOrdersRouter.request(`/satuan-catalog?academicYear=${encodeURIComponent(FUTURE_YEAR)}`);
      expect(closedRes.status).toBe(200);
      const closed = await closedRes.json();
      expect(closed.data.open).toBe(false);
      expect(closed.data.books).toEqual([]);

      await setSatuanOverride(FUTURE_YEAR, "open");
      const openRes = await publicOrdersRouter.request(`/satuan-catalog?academicYear=${encodeURIComponent(FUTURE_YEAR)}`);
      expect(openRes.status).toBe(200);
      const opened = await openRes.json();
      expect(opened.data.open).toBe(true);
      const row = opened.data.books.find((b: { id: string }) => b.id === bookId);
      expect(row).toBeDefined();
      // sellPrice 0 → fallback ke price (aturan kanonik tunggal)
      expect(row.sellPrice).toBe(80000);
    } finally {
      await db.delete(books).where(eq(books.id, bookId));
      await clearSettings(FUTURE_YEAR);
    }
  });
});
