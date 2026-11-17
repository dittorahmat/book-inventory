import type { AppDatabase } from "../../../db";
import type { SubmitUniformOrderPayload } from "../../../lib/uniform-types";
import { submitPublicOrder, type SubmitPublicOrderInput, type SubmitPublicOrderResult } from "./public-order";
import { submitUniformOrder } from "../uniform/orders";

export type OrderDomainKind = "buku" | "seragam";

export type UnifiedOrderIntakeInput =
  | { domain: "buku"; payload: SubmitPublicOrderInput }
  | { domain: "seragam"; payload: SubmitUniformOrderPayload };

export type UnifiedOrderIntakeResult =
  | { domain: "buku"; result: SubmitPublicOrderResult }
  | { domain: "seragam"; result: Awaited<ReturnType<typeof submitUniformOrder>> };

/**
 * Deep Module: UnifiedStudentOrderIntake
 * Menyediakan titik masuk tunggal bagi portal publik siswa untuk memvalidasi
 * kelayakan siswa, cut-off, dan eksekusi atomik batch penulisan pesanan.
 */
export async function executeStudentOrderIntake(
  database: AppDatabase,
  input: UnifiedOrderIntakeInput
): Promise<UnifiedOrderIntakeResult> {
  if (input.domain === "buku") {
    const result = await submitPublicOrder(input.payload, { database });
    return { domain: "buku", result };
  }

  const result = await submitUniformOrder(database, input.payload);
  return { domain: "seragam", result };
}

