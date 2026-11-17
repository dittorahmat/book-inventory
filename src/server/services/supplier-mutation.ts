import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookSuppliers, purchaseOrders, suppliers, uniformPos, vendorReturns } from "../../db/schema";
import { d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";

export type DeleteSupplierResult =
  | { ok: true; data: { id: string; name: string; code: string } }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Single-writer penghapusan master Supplier dengan guard integritas relasional ketat:
 * Menolak (400) jika supplier sudah memiliki riwayat Purchase Order (buku atau seragam),
 * retur vendor, atau relasi buku di book_suppliers.
 */
export async function deleteSupplier(
  database: AppDatabase,
  supplierId: string
): Promise<DeleteSupplierResult> {
  const [supplier] = await database.select().from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) {
    return { ok: false, status: 404, message: "Supplier tidak ditemukan" };
  }

  // 1. Cek relasi Purchase Order Buku
  const [po] = await database
    .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, supplierId))
    .limit(1);
  if (po) {
    return {
      ok: false,
      status: 400,
      message: `Supplier "${supplier.name}" tidak dapat dihapus karena tercatat dalam Purchase Order Buku "${po.poNumber}".`,
    };
  }

  // 2. Cek relasi PO Seragam / Konveksi
  const [uniformPo] = await database
    .select({ id: uniformPos.id, poNumber: uniformPos.poNumber })
    .from(uniformPos)
    .where(eq(uniformPos.supplierId, supplierId))
    .limit(1);
  if (uniformPo) {
    return {
      ok: false,
      status: 400,
      message: `Supplier "${supplier.name}" tidak dapat dihapus karena tercatat dalam PO Seragam "${uniformPo.poNumber}".`,
    };
  }

  // 3. Cek relasi Retur Vendor
  const [rtv] = await database
    .select({ id: vendorReturns.id, returnNumber: vendorReturns.returnNumber })
    .from(vendorReturns)
    .where(eq(vendorReturns.supplierId, supplierId))
    .limit(1);
  if (rtv) {
    return {
      ok: false,
      status: 400,
      message: `Supplier "${supplier.name}" tidak dapat dihapus karena tercatat dalam Retur Vendor "${rtv.returnNumber}".`,
    };
  }

  // 4. Cek relasi buku terdaftar
  const [bookLink] = await database
    .select({ bookId: bookSuppliers.bookId })
    .from(bookSuppliers)
    .where(eq(bookSuppliers.supplierId, supplierId))
    .limit(1);
  if (bookLink) {
    return {
      ok: false,
      status: 400,
      message: `Supplier "${supplier.name}" tidak dapat dihapus karena masih terhubung sebagai pemasok katalog buku.`,
    };
  }

  try {
    await runWriteBatch(database, [
      database.delete(suppliers).where(eq(suppliers.id, supplierId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penghapusan master supplier");
    if (mapped) return { ok: false, status: 400, message: mapped.message };
    throw err;
  }

  return {
    ok: true,
    data: {
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
    },
  };
}
