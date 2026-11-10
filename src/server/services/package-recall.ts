import type { AppDatabase } from "../../db";
import { type WriteDeps } from "../lib/d1-write";
import { kitPackage } from "./stock/package-kitting";
import type { DisassembleResult } from "./package-assembly";

export interface RecallUnbundlePayload {
  packageId: string;
  branchSchoolId: string;
  quantity: number;
  reason: string;
}

/**
 * Adapter seam: Penarikan sisa paket di cabang ke gudang pusat dan dibongkar
 * secara atomik menjadi buku satuan di gudang pusat sesuai Bill of Materials (BOM).
 * Mendelegasikan eksekusi penuh ke deep module kitPackage (mode: 'recall').
 */
export async function recallAndUnbundleBranchPackage(
  database: AppDatabase,
  payload: RecallUnbundlePayload,
  deps?: WriteDeps
): Promise<DisassembleResult> {
  const { packageId, branchSchoolId, quantity, reason } = payload;
  const result = await kitPackage(
    database,
    {
      mode: "recall",
      packageId,
      branchSchoolId,
      quantity,
      reason,
    },
    deps
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      packageId: result.data.packageId,
      unbundledCount: result.data.quantity,
      restoredLooseCount: result.data.restoredLooseCount ?? 0,
    },
  };
}
