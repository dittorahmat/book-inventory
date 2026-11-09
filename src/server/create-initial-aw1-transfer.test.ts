import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../db";
import {
  books,
  schools,
  bookStocks,
  transferShipments,
  transferShipmentItems,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createInitialAw1TransferShipment } from "./create-initial-aw1-transfer";

describe("createInitialAw1TransferShipment (§0.20, §0.62)", () => {
  const warehouseId = "school-warehouse";
  const aw1Id = "school-alw-1";
  const now = new Date().toISOString();

  beforeEach(async () => {
    // Bersihkan data uji terkait
    await db.delete(transferShipmentItems);
    await db.delete(transferShipments).where(eq(transferShipments.shipmentNumber, "TRF-AW1-2026-INITIAL"));
    await db.delete(bookStocks).where(eq(bookStocks.schoolId, aw1Id));
    await db.delete(books).where(eq(books.id, "b-test-akidah1"));
    await db.delete(books).where(eq(books.id, "b-test-math1a"));
    await db.delete(schools).where(eq(schools.id, warehouseId));
    await db.delete(schools).where(eq(schools.id, aw1Id));

    // Seed master schools
    await db.insert(schools).values([
      {
        id: warehouseId,
        name: "Gudang Logistik Pusat",
        code: "GUDANG-LOG",
        type: "warehouse",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: aw1Id,
        name: "Al Wildan 1 Gading Serpong",
        code: "ALW-01",
        type: "main",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Seed master books
    await db.insert(books).values([
      {
        id: "b-test-akidah1",
        isbn: "978-0000000010",
        title: "AKIDAH AKHLAK 1",
        author: "Al-Wildan",
        publisher: "Al-Wildan Press",
        price: 50000,
        buyPrice: 35000,
        sellPrice: 50000,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "b-test-math1a",
        isbn: "978-0000000011",
        title: "PRIME MATH 1A STUDENT BOOK",
        author: "Scholastic",
        publisher: "Scholastic",
        price: 198600,
        buyPrice: 119160,
        sellPrice: 198600,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("should create completed transfer shipment TRF-AW1-2026-INITIAL and initialize branch stock", async () => {
    const allocations = [
      { jenjang: "SD1", title: "Akidah Akhlak 1", quantity: 155 },
      { jenjang: "SD1", title: "Prime Math 1A Student Book", quantity: 120 },
    ];

    const result = await createInitialAw1TransferShipment(db, allocations, {
      fromSchoolId: warehouseId,
      toSchoolId: aw1Id,
      shipmentNumber: "TRF-AW1-2026-INITIAL",
      notes: "Alokasi awal pergerakan buku murid AW-1 TA 2026/2027",
    });

    expect(result.ok).toBe(true);
    expect(result.shipmentNumber).toBe("TRF-AW1-2026-INITIAL");
    expect(result.totalItems).toBe(2);
    expect(result.totalQuantity).toBe(275); // 155 + 120

    // 1. Verifikasi transfer_shipments
    const [shipment] = await db
      .select()
      .from(transferShipments)
      .where(eq(transferShipments.shipmentNumber, "TRF-AW1-2026-INITIAL"));
    expect(shipment).toBeDefined();
    expect(shipment.status).toBe("completed");
    expect(shipment.fromSchoolId).toBe(warehouseId);
    expect(shipment.toSchoolId).toBe(aw1Id);

    // 2. Verifikasi transfer_shipment_items
    const items = await db
      .select()
      .from(transferShipmentItems)
      .where(eq(transferShipmentItems.shipmentId, shipment.id));
    expect(items.length).toBe(2);

    // 3. Verifikasi book_stocks di cabang AW-1
    const [akidahStock] = await db
      .select()
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, "b-test-akidah1"), eq(bookStocks.schoolId, aw1Id)));
    expect(akidahStock).toBeDefined();
    expect(akidahStock.availableQuantity).toBe(155);

    const [mathStock] = await db
      .select()
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, "b-test-math1a"), eq(bookStocks.schoolId, aw1Id)));
    expect(mathStock).toBeDefined();
    expect(mathStock.availableQuantity).toBe(120);
  });

  afterEach(async () => {
    await db.delete(transferShipmentItems);
    await db.delete(transferShipments).where(eq(transferShipments.shipmentNumber, "TRF-AW1-2026-INITIAL"));
    await db.delete(bookStocks).where(eq(bookStocks.schoolId, aw1Id));
    await db.delete(books).where(eq(books.id, "b-test-akidah1"));
    await db.delete(books).where(eq(books.id, "b-test-math1a"));
    await db.delete(schools).where(eq(schools.id, warehouseId));
    await db.delete(schools).where(eq(schools.id, aw1Id));
  });
});
