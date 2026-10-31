import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { type WriteDeps } from "../lib/d1-write";
import type { StorageService } from "../../services/storage";
import {
  requestBookWithdrawal,
  type BookWithdrawalDeps,
} from "./book-withdrawal";
import {
  requestUniformWithdrawal,
  type UniformWithdrawalDeps,
} from "./uniform-withdrawal";

export type WithdrawalKind = "buku" | "seragam";

export interface RequestStudentWithdrawalInput {
  kind: WithdrawalKind;
  orderId: string;
  studentId: string;
  reason: string;
  letterProofBase64?: string;
  courierResi?: string;
}

export interface StudentWithdrawalDeps extends WriteDeps {
  storage?: StorageService;
  generateSlipNumber?: (now: string) => string;
}

export interface WithdrawalCancellationSuccess {
  ok: true;
  kind: WithdrawalKind;
  orderId: string;
  orderNumber: string;
  status?: string;
  refundId?: string;
}

export interface WithdrawalCancellationFailure {
  ok: false;
  status: ContentfulStatusCode;
  message: string;
}

export type WithdrawalCancellationResult =
  | WithdrawalCancellationSuccess
  | WithdrawalCancellationFailure;

/**
 * Seam terpadu pengajuan pembatalan akibat murid mengundurkan diri (ADR-0019).
 * Mengabstraksikan disparitas penanganan alokasi buku vs resi seragam di balik
 * satu interface polimorfik dengan leverage & locality tinggi.
 */
export async function requestStudentWithdrawal(
  database: AppDatabase,
  input: RequestStudentWithdrawalInput,
  deps: StudentWithdrawalDeps = {}
): Promise<WithdrawalCancellationResult> {
  if (input.kind === "buku") {
    const bookResult = await requestBookWithdrawal(
      database,
      {
        orderId: input.orderId,
        studentId: input.studentId,
        reason: input.reason,
        letterProofBase64: input.letterProofBase64,
      },
      deps as BookWithdrawalDeps
    );
    if (!bookResult.ok) return bookResult;
    return {
      ok: true,
      kind: "buku",
      orderId: bookResult.orderId,
      orderNumber: bookResult.orderNumber,
      status: bookResult.status,
    };
  }

  const uniformResult = await requestUniformWithdrawal(
    database,
    {
      orderId: input.orderId,
      studentId: input.studentId,
      reason: input.reason,
      courierResi: input.courierResi ?? "",
      letterProofBase64: input.letterProofBase64,
    },
    deps as UniformWithdrawalDeps
  );
  if (!uniformResult.ok) return uniformResult;
  return {
    ok: true,
    kind: "seragam",
    orderId: uniformResult.orderId,
    orderNumber: uniformResult.orderNumber,
    refundId: uniformResult.refundId,
  };
}
