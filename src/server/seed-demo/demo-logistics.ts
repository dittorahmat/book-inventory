import { eq } from "drizzle-orm";
import {
  bookItems,
  internalPurchaseOrderItems,
  internalPurchaseOrders,
  internalShipmentItems,
  internalShipments,
  transferShipmentItems,
  transferShipments,
} from "../../db/schema";
import { demoProofUrl, type SeedContext } from "./context";

export async function seedDemoLogistics({ db: targetDb, now }: SeedContext) {
  const shippedDate = now.slice(0, 10);

  // Pesanan internal cabang → gudang.
  await targetDb
    .insert(internalPurchaseOrders)
    .values([
      {
        id: "ipo-demo-01",
        poNumber: "IPO-202610-0001",
        schoolId: "school-alw-2",
        status: "submitted",
        notes: "Permintaan awal tahun untuk Kelas 2 Internasional.",
        createdByUserId: "usr-admin-cabang2",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "ipo-demo-02",
        poNumber: "IPO-202610-0002",
        schoolId: "school-alw-1",
        status: "partial_fulfilled",
        notes: "Sebagian sudah dikirim lewat SJ-INT-202610-0001.",
        createdByUserId: "usr-admin-pusat",
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoUpdate({
      target: internalPurchaseOrders.id,
      set: { status: "submitted", updatedAt: now },
    });
  // Status per baris ditetapkan eksplisit agar re-seed mengembalikan skenario.
  await targetDb
    .update(internalPurchaseOrders)
    .set({ status: "partial_fulfilled", updatedAt: now })
    .where(eq(internalPurchaseOrders.id, "ipo-demo-02"));

  const ipoLines = [
    { id: "ipoi-demo-01-1", internalPoId: "ipo-demo-01", packageId: "pkg-sd2-int", quantityOrdered: 2, quantityFulfilled: 0 },
    { id: "ipoi-demo-02-1", internalPoId: "ipo-demo-02", packageId: "pkg-sd1-int", quantityOrdered: 4, quantityFulfilled: 2 },
  ];
  for (const line of ipoLines) {
    await targetDb
      .insert(internalPurchaseOrderItems)
      .values({ ...line, createdAt: now })
      .onConflictDoUpdate({
        target: internalPurchaseOrderItems.id,
        set: { quantityFulfilled: line.quantityFulfilled },
      });
  }

  // Surat jalan internal: transit, diterima, selisih, dan riwayat push.
  const shipments = [
    { id: "ishp-demo-01", internalPoId: "ipo-demo-02", destinationSchoolId: "school-alw-1", deliveryNoteNumber: "SJ-INT-202610-0001", status: "in_transit" as const, receivedDate: null, proof: null },
    { id: "ishp-demo-02", internalPoId: "ipo-demo-01", destinationSchoolId: "school-alw-2", deliveryNoteNumber: "SJ-INT-202610-0002", status: "delivered" as const, receivedDate: now, proof: demoProofUrl("SJ Internal - Al Wildan 2") },
    { id: "ishp-demo-03", internalPoId: null, destinationSchoolId: "school-alw-1", deliveryNoteNumber: "SJ-INT-202610-0003", status: "delivered" as const, receivedDate: now, proof: demoProofUrl("Distribusi Awal Tahun - Al Wildan 1") },
    { id: "ishp-demo-04", internalPoId: null, destinationSchoolId: "school-alw-3", deliveryNoteNumber: "SJ-INT-202610-0004", status: "discrepancy" as const, receivedDate: now, proof: demoProofUrl("SJ Selisih - Al Wildan 3") },
    { id: "ishp-demo-05", internalPoId: null, destinationSchoolId: "school-alw-3", deliveryNoteNumber: "SJ-PUSH-202610-0001", status: "delivered" as const, receivedDate: now, proof: demoProofUrl("Push Distribution - Al Wildan 3") },
  ];
  for (const shipment of shipments) {
    await targetDb
      .insert(internalShipments)
      .values({
        id: shipment.id,
        internalPoId: shipment.internalPoId,
        destinationSchoolId: shipment.destinationSchoolId,
        deliveryNoteNumber: shipment.deliveryNoteNumber,
        shippedDate,
        receivedDate: shipment.receivedDate,
        status: shipment.status,
        deliveryProofUrl: shipment.proof,
        shippedByUserId: "usr-admin-gudang",
        receivedByUserId: shipment.receivedDate ? "usr-admin-pusat" : null,
        notes: shipment.id === "ishp-demo-05" ? "[Push Distribution] kuota siswa aktif" : "Pengiriman internal demo.",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: internalShipments.id,
        set: { status: shipment.status, receivedDate: shipment.receivedDate, deliveryProofUrl: shipment.proof, updatedAt: now },
      });
  }

  const shipmentItems = [
    { id: "ishi-demo-01-1", shipmentId: "ishp-demo-01", packageId: "pkg-sd1-int", quantity: 2, condition: null },
    { id: "ishi-demo-02-1", shipmentId: "ishp-demo-02", packageId: "pkg-sd2-int", quantity: 2, condition: "good" as const },
    { id: "ishi-demo-03-1", shipmentId: "ishp-demo-03", packageId: "pkg-sd1-int", quantity: 10, condition: "good" as const },
    { id: "ishi-demo-04-1", shipmentId: "ishp-demo-04", packageId: "pkg-sd1-int", quantity: 2, condition: "good" as const },
    { id: "ishi-demo-04-2", shipmentId: "ishp-demo-04", packageId: "pkg-sd1-int", quantity: 1, condition: "damaged" as const },
    { id: "ishi-demo-05-1", shipmentId: "ishp-demo-05", packageId: "pkg-sd1-int", quantity: 2, condition: "good" as const },
  ];
  for (const item of shipmentItems) {
    await targetDb
      .insert(internalShipmentItems)
      .values({
        id: item.id,
        shipmentId: item.shipmentId,
        packageId: item.packageId,
        quantity: item.quantity,
        receivedCondition: item.condition,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: internalShipmentItems.id,
        set: { quantity: item.quantity, receivedCondition: item.condition },
      });
  }

  // Transfer antar sekolah: draft, transit, selesai.
  const transfers = [
    { id: "trf-demo-01", shipmentNumber: "TRF-202610-0001", from: "school-alw-1", to: "school-alw-2", status: "draft" as const, dispatchedAt: null, receivedAt: null, reason: "Penyesuaian stok cabang 2." },
    { id: "trf-demo-02", shipmentNumber: "TRF-202610-0002", from: "school-alw-1", to: "school-alw-3", status: "in_transit" as const, dispatchedAt: now, receivedAt: null, reason: "Kekurangan buku Bahasa Arab." },
    { id: "trf-demo-03", shipmentNumber: "TRF-202610-0003", from: "school-alw-1", to: "school-alw-2", status: "completed" as const, dispatchedAt: now, receivedAt: now, reason: "Penambahan stok Tahfidz." },
  ];
  for (const transfer of transfers) {
    await targetDb
      .insert(transferShipments)
      .values({
        id: transfer.id,
        shipmentNumber: transfer.shipmentNumber,
        fromSchoolId: transfer.from,
        toSchoolId: transfer.to,
        status: transfer.status,
        dispatchedAt: transfer.dispatchedAt,
        receivedAt: transfer.receivedAt,
        reason: transfer.reason,
        notes: "Transfer demo.",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: transferShipments.id,
        set: { status: transfer.status, dispatchedAt: transfer.dispatchedAt, receivedAt: transfer.receivedAt, updatedAt: now },
      });
  }
  const transferLines = [
    { id: "trfi-demo-01-1", shipmentId: "trf-demo-01", bookItemId: "bi-loose-b-pai-1-19", unitPriceSnapshot: 55000 },
    { id: "trfi-demo-02-1", shipmentId: "trf-demo-02", bookItemId: "bi-loose-b-arab-1-19", unitPriceSnapshot: 65000 },
    { id: "trfi-demo-03-1", shipmentId: "trf-demo-03", bookItemId: "bi-loose-b-tahfidz-1-19", unitPriceSnapshot: 75000 },
  ];
  for (const line of transferLines) {
    await targetDb
      .insert(transferShipmentItems)
      .values({
        id: line.id,
        shipmentId: line.shipmentId,
        itemType: "loose",
        bookItemId: line.bookItemId,
        quantity: 1,
        unitPriceSnapshot: line.unitPriceSnapshot,
        createdAt: now,
      })
      .onConflictDoNothing();
  }
  await targetDb
    .update(bookItems)
    .set({ status: "in_transit", updatedAt: now })
    .where(eq(bookItems.id, "bi-loose-b-arab-1-19"));
  await targetDb
    .update(bookItems)
    .set({ currentSchoolId: "school-alw-2", status: "in_stock", updatedAt: now })
    .where(eq(bookItems.id, "bi-loose-b-tahfidz-1-19"));
}
