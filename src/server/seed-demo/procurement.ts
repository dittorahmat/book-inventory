import {
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  systemSettings,
} from "../../db/schema";
import type { SeedContext } from "./context";

export async function seedProcurement({ db: targetDb, now }: SeedContext) {
  const existingSuppliers = await targetDb.select().from(suppliers);
  if (existingSuppliers.length === 0) {
    await targetDb.insert(suppliers).values([
      {
        id: "sup-erlangga",
        code: "SUP-ERL",
        name: "PT Penerbit Erlangga Mahameru",
        contactPerson: "Drs. Hendro Wibowo",
        email: "order@erlangga.co.id",
        phone: "+62 21 8717888",
        address: "Jl. H. Baping Raya No. 100, Ciracas, Jakarta Timur",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sup-cambridge-mentari",
        code: "SUP-MEN",
        name: "PT Mentari Books Utama (Cambridge Official Distributor)",
        contactPerson: "Lina Marlina, M.Ed",
        email: "cambridge@mentaribooks.com",
        phone: "+62 21 5890888",
        address: "Rukan Puri Mutiara Blok A No. 15, Kembangan, Jakarta Barat",
        createdAt: now,
        updatedAt: now,
      },
    ]).onConflictDoNothing();

    await targetDb.insert(purchaseOrders).values({
      id: "po-demo-001",
      poNumber: "PO-202609-0088",
      supplierId: "sup-cambridge-mentari",
      targetSchoolId: "school-warehouse",
      status: "partially_received",
      orderDate: "2026-09-20",
      expectedArrivalDate: "2026-09-28",
      totalAmount: 18500000,
      notes: "Pengadaan awal buku Cambridge Mathematics & Science Semester 1",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await targetDb.insert(purchaseOrderItems).values([
      {
        id: "poi-demo-1",
        purchaseOrderId: "po-demo-001",
        bookId: "b-math-1",
        quantityOrdered: 100,
        quantityReceived: 40,
        unitPrice: 95000,
        createdAt: now,
      },
      {
        id: "poi-demo-2",
        purchaseOrderId: "po-demo-001",
        bookId: "b-sci-1",
        quantityOrdered: 100,
        quantityReceived: 40,
        unitPrice: 90000,
        createdAt: now,
      },
    ]).onConflictDoNothing();
  }

  await targetDb.insert(systemSettings).values({
    key: "smtp_host",
    value: "smtp.gmail.com",
    description: "Default SMTP Host",
    updatedAt: now,
  }).onConflictDoNothing();
}
