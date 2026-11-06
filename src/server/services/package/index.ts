import type { AppDatabase } from "../../../db";
import type { WriteDeps } from "../../lib/d1-write";
import {
  deletePackageWithAutoUnbundle,
  unbundleAllActiveBundles,
  updatePackageWithAutoUnbundle,
  type DeletePackageResult,
  type UnbundleAllResult,
  type UpdatePackagePayload,
  type UpdatePackageResult,
} from "../package-mutation";
import {
  assemblePackageBundles,
  disassemblePackageBundles,
  type AssembleResult,
  type DisassembleResult,
  type AssemblyError,
} from "../package-assembly";

export type {
  DeletePackageResult,
  UnbundleAllResult,
  UpdatePackagePayload,
  UpdatePackageResult,
  AssembleResult,
  DisassembleResult,
  AssemblyError,
};

/**
 * Deep Module: Titik masuk kanonik untuk manajemen siklus hidup paket buku.
 * Mengenkapsulasi perakitan (kitting), pembongkaran, edit BOM dengan auto-unbundle,
 * dan penghapusan paket aman dengan rekonsiliasi stok satuan.
 */
export async function assemblePackage(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  quantity: number,
  deps?: WriteDeps
): Promise<AssembleResult> {
  return assemblePackageBundles(database, packageId, schoolId, quantity, deps);
}

export async function disassemblePackage(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  quantity: number,
  reason: string,
  deps?: WriteDeps
): Promise<DisassembleResult> {
  return disassemblePackageBundles(database, packageId, schoolId, quantity, reason, deps);
}

export async function updatePackageBOM(
  database: AppDatabase,
  packageId: string,
  payload: UpdatePackagePayload,
  deps?: WriteDeps
): Promise<UpdatePackageResult> {
  return updatePackageWithAutoUnbundle(database, packageId, payload, deps);
}

export async function removePackage(
  database: AppDatabase,
  packageId: string,
  deps?: WriteDeps
): Promise<DeletePackageResult> {
  return deletePackageWithAutoUnbundle(database, packageId, deps);
}

export async function unbundleAll(
  database: AppDatabase,
  packageId: string,
  reason: string,
  deps?: WriteDeps
): Promise<UnbundleAllResult> {
  return unbundleAllActiveBundles(database, packageId, reason, deps);
}
