import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { type WriteDeps } from "../lib/d1-write";
import { kitPackage } from "./stock/package-kitting";

export type AssemblyError = { ok: false; status: ContentfulStatusCode; message: string };

export type AssembleResult =
  | {
      ok: true;
      data: {
        packageId: string;
        quantityAssembled: number;
        assembledItems: Array<{ id: string; barcode: string }>;
      };
    }
  | AssemblyError;

export type DisassembleResult =
  | {
      ok: true;
      data: {
        packageId: string;
        unbundledCount: number;
        restoredLooseCount: number;
      };
    }
  | AssemblyError;

/**
 * Adapter seam: perakitan fisik paket buku (kitting).
 * Mendelegasikan eksekusi penuh ke deep module kitPackage.
 */
export async function assemblePackageBundles(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  quantity: number,
  deps?: WriteDeps
): Promise<AssembleResult> {
  const result = await kitPackage(
    database,
    {
      mode: "assemble",
      schoolId,
      packageId,
      quantity,
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
      quantityAssembled: result.data.quantity,
      assembledItems: result.data.assembledItems ?? [],
    },
  };
}

/**
 * Adapter seam: pembongkaran paket fisik (de-kitting / unbundling).
 * Mendelegasikan eksekusi penuh ke deep module kitPackage.
 */
export async function disassemblePackageBundles(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  quantity: number,
  reason: string,
  deps?: WriteDeps
): Promise<DisassembleResult> {
  const result = await kitPackage(
    database,
    {
      mode: "disassemble",
      schoolId,
      packageId,
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
