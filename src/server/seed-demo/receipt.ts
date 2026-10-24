import type { ReceiptInput } from "../services/payment-ledger";
import { buildReceiptDraft, upsertReceiptQueries } from "../services/payment-ledger";
import type { SeedContext } from "./context";

/**
 * Tulis satu struk demo lewat pembentuk baris kanonik `payment-ledger`, supaya
 * seed tidak merakit baris struk/alokasi sendiri (AGENTS.md §0.4).
 */
export async function seedReceipt(ctx: SeedContext, receiptId: string, input: ReceiptInput): Promise<void> {
  const built = buildReceiptDraft(input, ctx.now, receiptId);
  if (!built.ok) throw new Error(`Seed struk ${receiptId} ditolak: ${built.message}`);
  for (const query of upsertReceiptQueries(ctx.db, built.draft)) await query;
}
