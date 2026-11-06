import type { AppDatabase } from "../../../db";
import {
  adjustLooseStock,
  adjustPackageStock,
  recordStockAdjustment,
} from "./aggregate";
import type { StockAdjustmentInput } from "./aggregate";
import type { WriteDeps } from "../../lib/d1-write";

export type StockMovementType =
  | "adjustment"      // opname / write-off / koreksi manual
  | "receipt"         // penerimaan PO supplier
  | "handover"        // serah terima ke siswa
  | "transfer"        // transfer antar sekolah (debit asal, credit tujuan)
  | "assembly"        // kitting buku satuan menjadi bundel paket
  | "disassembly";    // unbundling paket menjadi buku satuan

export interface InventoryMovementInput {
  movementType: StockMovementType;
  itemType: "loose" | "package";
  bookId?: string;
  packageId?: string;
  quantity: number; // kuantitas positif
  fromSchoolId?: string; // asal (untuk transfer / debit)
  toSchoolId?: string;   // tujuan (untuk transfer / receipt / credit)
  schoolId?: string;     // lokasi tunggal (adjustment / handover / dsb)
  reason?: StockAdjustmentInput["reason"];
  referenceDocumentNumber?: string;
  notes?: string;
  adjustedByUserId?: string;
}

export interface StockMovementResult {
  ok: boolean;
  message?: string;
  adjustmentId?: string;
}

/**
 * Deep module: Satu-satunya pemilik mutasi pergerakan inventaris agregat.
 * Mengenkapsulasi validasi saldo, debit/credit antar-lokasi, dan audit trail otomatis.
 */
export async function moveInventoryStock(
  database: AppDatabase,
  input: InventoryMovementInput,
  deps: WriteDeps = {}
): Promise<StockMovementResult> {
  const qty = Math.abs(input.quantity);
  if (qty === 0) return { ok: true };

  const targetSchoolId = input.schoolId || input.toSchoolId;
  const sourceSchoolId = input.schoolId || input.fromSchoolId;

  switch (input.movementType) {
    case "receipt": {
      if (!targetSchoolId) {
        return { ok: false, message: "Lokasi penerimaan (toSchoolId/schoolId) wajib diisi." };
      }
      if (input.itemType === "loose") {
        if (!input.bookId) return { ok: false, message: "bookId wajib untuk receipt buku satuan." };
        const res = await adjustLooseStock(database, input.bookId, targetSchoolId, qty, deps);
        if (!res.ok) return { ok: false, message: "Gagal menambahkan stok penerimaan." };
      } else {
        if (!input.packageId) return { ok: false, message: "packageId wajib untuk receipt paket." };
        const res = await adjustPackageStock(database, input.packageId, targetSchoolId, qty, deps);
        if (!res.ok) return { ok: false, message: "Gagal menambahkan stok paket penerimaan." };
      }
      return { ok: true };
    }

    case "handover": {
      if (!sourceSchoolId) {
        return { ok: false, message: "Lokasi serah terima (schoolId/fromSchoolId) wajib diisi." };
      }
      if (input.itemType === "loose") {
        if (!input.bookId) return { ok: false, message: "bookId wajib untuk handover buku satuan." };
        const res = await adjustLooseStock(database, input.bookId, sourceSchoolId, -qty, deps);
        if (!res.ok) return { ok: false, message: "Stok buku satuan tidak mencukupi untuk serah terima." };
      } else {
        if (!input.packageId) return { ok: false, message: "packageId wajib untuk handover paket." };
        const res = await adjustPackageStock(database, input.packageId, sourceSchoolId, -qty, deps);
        if (!res.ok) return { ok: false, message: "Stok paket tidak mencukupi untuk serah terima." };
      }
      return { ok: true };
    }

    case "transfer": {
      if (!input.fromSchoolId || !input.toSchoolId) {
        return { ok: false, message: "fromSchoolId dan toSchoolId wajib untuk transfer inventaris." };
      }
      if (input.fromSchoolId === input.toSchoolId) {
        return { ok: true }; // No-op transfer lokasi sama
      }
      // Debit asal
      if (input.itemType === "loose") {
        if (!input.bookId) return { ok: false, message: "bookId wajib untuk transfer buku satuan." };
        const debitRes = await adjustLooseStock(database, input.bookId, input.fromSchoolId, -qty, deps);
        if (!debitRes.ok) return { ok: false, message: "Stok asal tidak mencukupi untuk transfer." };
        await adjustLooseStock(database, input.bookId, input.toSchoolId, qty, deps);
      } else {
        if (!input.packageId) return { ok: false, message: "packageId wajib untuk transfer paket." };
        const debitRes = await adjustPackageStock(database, input.packageId, input.fromSchoolId, -qty, deps);
        if (!debitRes.ok) return { ok: false, message: "Stok paket asal tidak mencukupi untuk transfer." };
        await adjustPackageStock(database, input.packageId, input.toSchoolId, qty, deps);
      }
      return { ok: true };
    }

    case "adjustment": {
      const loc = input.schoolId || input.fromSchoolId || input.toSchoolId;
      if (!loc) {
        return { ok: false, message: "Lokasi penyesuaian (schoolId) wajib diisi." };
      }
      const adjRes = await recordStockAdjustment(
        database,
        {
          schoolId: loc,
          itemType: input.itemType,
          bookId: input.bookId,
          packageId: input.packageId,
          quantity: input.quantity, // bisa negatif atau positif
          reason: input.reason ?? "manual_correction",
          referenceDocumentNumber: input.referenceDocumentNumber,
          notes: input.notes,
          adjustedByUserId: input.adjustedByUserId,
        },
        deps
      );
      return { ok: adjRes.ok, adjustmentId: adjRes.adjustmentId };
    }

    case "assembly": {
      const loc = input.schoolId || input.toSchoolId;
      if (!loc) return { ok: false, message: "Lokasi rakit (schoolId) wajib diisi." };
      if (!input.packageId) return { ok: false, message: "packageId wajib untuk assembly." };
      const res = await adjustPackageStock(database, input.packageId, loc, qty, deps);
      return { ok: res.ok };
    }

    case "disassembly": {
      const loc = input.schoolId || input.fromSchoolId;
      if (!loc) return { ok: false, message: "Lokasi bongkar (schoolId) wajib diisi." };
      if (!input.packageId) return { ok: false, message: "packageId wajib untuk disassembly." };
      const res = await adjustPackageStock(database, input.packageId, loc, -qty, deps);
      return { ok: res.ok };
    }

    default:
      return { ok: false, message: "Tipe pergerakan stok tidak didukung." };
  }
}
