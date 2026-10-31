import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { mockActor, restoreActor } from "./test-actor";
import { bookReturnsRouter } from "./book-returns";
import { db } from "../../db";
import { schools, books, students, studentBookOrders, bookReturns, refundSlips } from "../../db/schema";
import { dropSeed, seedBook, seedSchool, seedStudent } from "../lib/test-seed";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});

describe("Book Returns & Refund API", () => {
  it("allows querying returns list and exporting CSV report", async () => {
    const stamp = Date.now();
    const schoolId = `school-ret-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Cabang Retur Test",
      code: `CRT-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    const studentId = `stu-ret-${stamp}`;
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `NIS-R-${stamp}`,
      name: "Siswa Retur",
      gradeLevel: "1",
      academicYear: "2026/2027",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const bookId = `book-ret-${stamp}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `978-602-${stamp.toString().slice(-6)}`,
      title: "Buku Rusak Test",
      author: "Penulis Test",
      publisher: "Penerbit Test",
      createdAt: now,
      updatedAt: now,
    });

    const orderId = `ord-ret-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-R-${stamp}`,
      studentId,
      schoolId,
      createdAt: now,
      updatedAt: now,
    });

    const returnId = `ret-${stamp}`;
    await db.insert(bookReturns).values({
      id: returnId,
      orderId,
      studentId,
      defectiveBookId: bookId,
      reason: "Halaman robek",
      status: "approved",
      refundAmount: 50000,
      createdAt: now,
      updatedAt: now,
    });

    // Test GET /
    const listRes = await bookReturnsRouter.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { success: boolean; data: Array<{ id: string }> };
    expect(listJson.success).toBe(true);
    expect(listJson.data.some((r) => r.id === returnId)).toBe(true);

    // Test GET /export
    const expRes = await bookReturnsRouter.request(`/export?schoolId=${schoolId}&status=approved`, { method: "GET" });
    expect(expRes.status).toBe(200);
    expect(expRes.headers.get("content-type")).toContain("text/csv");
    const csv = await expRes.text();
    expect(csv).toContain("No Order,Sekolah,Nama Siswa");
    expect(csv).toContain("ORD-R-");
    expect(csv).toContain("50000");
  });

  it("menolak retur ganda untuk buku yang sama dan tetap mengizinkan buku lain di pesanan yang sama", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `school-ret-dup-${stamp}`;
    const studentId = `stu-ret-dup-${stamp}`;
    const bookAId = `book-ret-dup-a-${stamp}`;
    const bookBId = `book-ret-dup-b-${stamp}`;
    const orderId = `ord-ret-dup-${stamp}`;

    await db.insert(schools).values({
      id: schoolId,
      name: "Cabang Retur Ganda Test",
      code: `CRD-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `NIS-RD-${stamp}`,
      name: "Siswa Retur Ganda",
      gradeLevel: "1",
      academicYear: "2026/2027",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(books).values([
      {
        id: bookAId,
        isbn: `ISBN-RD-A-${stamp}`,
        title: "Buku Rusak A",
        author: "Penulis Test",
        publisher: "Penerbit Test",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: bookBId,
        isbn: `ISBN-RD-B-${stamp}`,
        title: "Buku Rusak B",
        author: "Penulis Test",
        publisher: "Penerbit Test",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-RD-${stamp}`,
      studentId,
      schoolId,
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      totalAmount: 180000,
      paidAmount: 180000,
      createdAt: now,
      updatedAt: now,
    });

    const postReturn = (defectiveBookId: string) =>
      bookReturnsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, studentId, defectiveBookId, reason: "Halaman sobek" }),
      });

    try {
      // Laporan pertama untuk buku A tersimpan.
      const first = await postReturn(bookAId);
      expect(first.status).toBe(201);

      // Buku A dilaporkan lagi selama laporan pertama masih terbuka: ditolak.
      const duplicate = await postReturn(bookAId);
      expect(duplicate.status).toBe(400);
      expect((await duplicate.json()).message).toContain("sedang diproses");

      // Buku lain dari pesanan yang sama tetap boleh (multi-buku, bukan satu per pesanan).
      const sibling = await postReturn(bookBId);
      expect(sibling.status).toBe(201);

      const rows = await db.select().from(bookReturns).where(eq(bookReturns.orderId, orderId));
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((r) => r.defectiveBookId))).toEqual(new Set([bookAId, bookBId]));

      const [order] = await db
        .select()
        .from(studentBookOrders)
        .where(eq(studentBookOrders.id, orderId));
      expect(order.fulfillmentStatus).toBe("return_in_progress");
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.orderId, orderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(books).where(inArray(books.id, [bookAId, bookBId]));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("approve-withdrawal > menyetujui pembatalan buku siswa mundur, unassign paket, dan menerbitkan slip RET-B", async () => {
    const { packageItems, bookPackages } = await import("../../db/schema");
    const stamp = Date.now().toString(36);
    const schoolId = `sch-app-${stamp}`;
    const studentId = `stu-app-${stamp}`;
    const orderId = `ord-app-${stamp}`;
    const bookId = `b-app-${stamp}`;
    const pkgId = `pkg-app-${stamp}`;
    const pkiId = `pki-app-${stamp}`;
    const returnId = `ret-app-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({ id: schoolId, name: "Sekolah App", code: `SA-${stamp}`, type: "branch", createdAt: now, updatedAt: now });
    await db.insert(students).values({ id: studentId, nis: `NIS-APP-${stamp}`, name: "Siswa Mundur App", schoolId, gradeLevel: "1", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now });
    await db.insert(books).values({ id: bookId, title: "Buku App", isbn: `ISBN-${stamp}`, author: "Penulis App", publisher: "Pub", publishYear: 2026, price: 50000, createdAt: now, updatedAt: now });
    await db.insert(bookPackages).values({ id: pkgId, code: `PKG-${stamp}`, name: "Paket App", gradeLevel: "1", academicYear: "2026/2027", price: 150000, createdAt: now, updatedAt: now });
    await db.insert(packageItems).values({ id: pkiId, packageId: pkgId, currentSchoolId: schoolId, barcode: `BAR-APP-${stamp}`, status: "reserved", createdAt: now, updatedAt: now });
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-APP-${stamp}`,
      studentId,
      schoolId,
      packageId: pkgId,
      assignedPackageItemId: pkiId,
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "return_in_progress",
      totalAmount: 150000,
      paidAmount: 150000,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(bookReturns).values({
      id: returnId,
      orderId,
      studentId,
      defectiveBookId: bookId,
      kind: "withdrawal",
      reason: "Pindah domisili keluarga",
      status: "reported",
      createdAt: now,
      updatedAt: now,
    });

    let slipNumber = "";
    try {
      const res = await bookReturnsRouter.request(`/${returnId}/approve-withdrawal`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: { slipNumber: string; refundAmount: number } };
      slipNumber = json.data.slipNumber;
      expect(json.success).toBe(true);
      expect(json.data.slipNumber).toMatch(/^RET-B-/);
      expect(json.data.refundAmount).toBe(150000);

      // Verifikasi stok paket otomatis kembali menjadi in_stock (stok bebas cabang)
      const [unassignedPki] = await db.select().from(packageItems).where(eq(packageItems.id, pkiId));
      expect(unassignedPki.status).toBe("in_stock");

      // Verifikasi relasi order
      const [updatedOrder] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(updatedOrder.assignedPackageItemId).toBeNull();

      // Verifikasi slip tersimpan sebagai baris tabel (bukan KV JSON)
      const [slipRow] = await db.select().from(refundSlips).where(eq(refundSlips.slipNumber, slipNumber));
      expect(slipRow).toBeDefined();
      expect(slipRow.orderNumber).toBe(`ORD-APP-${stamp}`);
      expect(slipRow.kind).toBe("buku");
      expect(slipRow.status).toBe("approved");
    } finally {
      if (slipNumber) await db.delete(refundSlips).where(eq(refundSlips.slipNumber, slipNumber));
      await db.delete(bookReturns).where(eq(bookReturns.id, returnId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, pkiId));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("menolak approve-withdrawal untuk laporan retur barang cacat", async () => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e3)}`;
    const now = new Date().toISOString();
    const schoolId = await seedSchool(`wdk-${stamp}`, "Sekolah Withdrawal Kind");
    const studentId = await seedStudent(`wdk-${stamp}`, schoolId, "Murid Kind");
    const bookId = await seedBook(`wdk-${stamp}`, "Buku Kind");
    const orderId = `ord-wdk-${stamp}`;
    const returnId = `ret-wdk-${stamp}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-WDK-${stamp}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "picked_up",
        totalAmount: 50000, paidAmount: 0, createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: returnId, orderId, studentId, defectiveBookId: bookId,
        kind: "defect", reason: "Halaman sobek", status: "reported",
        createdAt: now, updatedAt: now,
      });

      const res = await bookReturnsRouter.request(`/${returnId}/approve-withdrawal`, { method: "POST" });
      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain("bukan pengajuan pengunduran diri");
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, returnId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await dropSeed({ schoolIds: [schoolId], studentIds: [studentId], bookIds: [bookId] });
    }
  });
});
