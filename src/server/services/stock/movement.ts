import type { AppDatabase } from "../../../db";
import {
  adjustLooseStock,
  adjustPackageStock,
  recordStockAdjustment,
} from "./aggregate";
import type { StockAdjustmentInput } from "./aggregate";
import type { WriteDeps } from "../../lib/d1-write";

export type StockMovementType =
  | "adjustment"            // opname / write-off / koreksi manual
  | "receipt"               // penerimaan PO supplier
  | "handover"              // serah terima ke siswa
  | "transfer"              // transfer antar sekolah (debit asal, credit tujuan)
  | "transfer_discrepancy"  // debit asal dan catat selisih rusak/hilang di tujuan
  | "assembly"              // kitting buku satuan menjadi bundel paket
  | "disassembly";          // unbundling paket menjadi buku satuan

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
  updateStockBalance?: boolean;
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

    case "transfer_discrepancy": {
      if (!input.fromSchoolId || !input.toSchoolId) {
        return { ok: false, message: "fromSchoolId dan toSchoolId wajib untuk transfer_discrepancy." };
      }
      // 1. Debit stok asal (barang keluar dari asal)
      if (input.itemType === "loose") {
        if (!input.bookId) return { ok: false, message: "bookId wajib untuk transfer_discrepancy buku satuan." };
        const debitRes = await adjustLooseStock(database, input.bookId, input.fromSchoolId, -qty, deps);
        if (!debitRes.ok) return { ok: false, message: "Stok asal tidak mencukupi untuk transfer selisih." };
      } else {
        if (!input.packageId) return { ok: false, message: "packageId wajib untuk transfer_discrepancy paket." };
        const debitRes = await adjustPackageStock(database, input.packageId, input.fromSchoolId, -qty, deps);
        if (!debitRes.ok) return { ok: false, message: "Stok paket asal tidak mencukupi untuk transfer selisih." };
      }
      // 2. Catat audit selisih (rusak/hilang) di tujuan tanpa menambah saldo available tujuan
      const adjRes = await recordStockAdjustment(
        database,
        {
          schoolId: input.toSchoolId,
          itemType: input.itemType,
          bookId: input.bookId,
          packageId: input.packageId,
          quantity: -qty,
          reason: input.reason ?? "damaged",
          referenceDocumentNumber: input.referenceDocumentNumber,
          notes: input.notes,
          adjustedByUserId: input.adjustedByUserId,
          updateStockBalance: false,
        },
        deps
      );
      return { ok: adjRes.ok, adjustmentId: adjRes.adjustmentId };
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
          updateStockBalance: input.updateStockBalance,
        },
        deps
      );
      return { ok: adjRes.ok, adjustmentId: adjRes.adjustmentId };
    }

    case "assembly": {
      const loc = input.schoolId || input.toSchoolId;
      if (!loc) return { ok: false, message: "Lokasi rakit (schoolId) wajib diisi." };
      const isPackage = input.itemType === "package";
      if (isPackage) {
        if (!input.packageId) return { ok: false, message: "packageId wajib untuk assembly paket." };
        const res = await adjustPackageStock(database, input.packageId, loc, qty, deps);
        return { ok: res.ok };
      }
      if (!input.bookId) return { ok: false, message: "bookId wajib untuk konsumsi assembly buku satuan." };
      const debitRes = await adjustLooseStock(database, input.bookId, loc, -qty, deps);
      if (!debitRes.ok) return { ok: false, message: "Stok buku satuan tidak mencukupi untuk perakitan paket." };
      return { ok: true };
    }

    case "disassembly": {
      const loc = input.schoolId || input.fromSchoolId;
      if (!loc) return { ok: false, message: "Lokasi bongkar (schoolId) wajib diisi." };
      const isPackage = input.itemType === "package";
      if (isPackage) {
        if (!input.packageId) return { ok: false, message: "packageId wajib untuk disassembly paket." };
        const res = await adjustPackageStock(database, input.packageId, loc, -qty, deps);
        return { ok: res.ok };
      }
      if (!input.bookId) return { ok: false, message: "bookId wajib untuk restorasi disassembly buku satuan." };
      await adjustLooseStock(database, input.bookId, loc, qty, deps);
      return { ok: true };
    }

    default:
      return { ok: false, message: "Tipe pergerakan stok tidak didukung." };
  }
}
