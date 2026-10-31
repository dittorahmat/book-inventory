import { inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import { books } from "../../../db/schema";
import { effectiveSellPrice } from "../../../lib/book-pricing";
import { allocateInventoryStock } from "../stock";
import { validateLooseBooks } from "./validation";

export interface IntakeLooseItem {
  bookId: string;
  quantity: number;
}

export interface IntakeLooseLine {
  bookId: string;
  title: string;
  quantity: number;
  unitPrice: number;
}

export type IntakeError = { ok: false; status: ContentfulStatusCode; message: string };

/**
 * Satu-satunya pemilik resolusi baris satuan intake: ambil harga jual
 * efektif + validasi keberadaan judul. Dipakai intake publik dan Direct
 * Sale agar aturan harga dan 404 judul berubah di satu tempat.
 */
export async function resolveLooseLines(
  database: AppDatabase,
  items: IntakeLooseItem[]
): Promise<{ ok: true; lines: IntakeLooseLine[] } | IntakeError> {
  const bookIds = [...new Set(items.map((i) => i.bookId))];
  type PriceRow = { id: string; title: string; price: number; sellPrice: number };
  const bookRows: PriceRow[] =
    bookIds.length > 0
      ? await database
          .select({ id: books.id, title: books.title, price: books.price, sellPrice: books.sellPrice })
          .from(books)
          .where(inArray(books.id, bookIds))
      : [];
  const booksCheck = validateLooseBooks(bookIds, new Set(bookRows.map((b: PriceRow) => b.id)));
  if (!booksCheck.ok) return booksCheck;
  const bookMap = new Map<string, PriceRow>(bookRows.map((b: PriceRow) => [b.id, b]));
  return {
    ok: true,
    lines: items.map((item) => {
      const book = bookMap.get(item.bookId);
      return {
        bookId: item.bookId,
        title: book?.title ?? "",
        quantity: item.quantity,
        unitPrice: effectiveSellPrice(book ?? { price: 0 }),
      };
    }),
  };
}

export interface FailedReservation {
  bookId: string;
  quantity: number;
  available: number;
  status: ContentfulStatusCode;
  message: string;
}

/**
 * Satu-satunya pintu alokasi FIFO untuk baris satuan intake: agregasi
 * kuantitas per judul lalu alokasi sekuensial via seam `allocateInventoryStock`
 * (AGENTS §0.15). Alokasi ini MURNI BACA — tidak ada unit yang dikunci.
 * Pemanggil yang langsung mengonsumsi unit (Direct Sale) memakai
 * `allocatedIds`; submit publik hanya memakainya sebagai verifikasi
 * ketersediaan karena fisik baru dikonsumsi saat serah terima (ADR-0018).
 * Karena itu nama fungsi menyebut "allocate", bukan "reserve".
 */
export async function allocateLooseLines(
  database: AppDatabase,
  schoolId: string,
  lines: IntakeLooseLine[]
): Promise<{ ok: true; allocatedIds: string[] } | ({ ok: false } & FailedReservation)> {
  const aggregated = new Map<string, number>();
  for (const line of lines) aggregated.set(line.bookId, (aggregated.get(line.bookId) ?? 0) + line.quantity);
  const allocatedIds: string[] = [];
  for (const [bookId, quantity] of aggregated) {
    const available = await allocateInventoryStock(
      { kind: "loose", targetId: bookId, schoolId, quantity },
      database
    );
    if (!available.ok) {
      return {
        ok: false,
        bookId,
        quantity,
        available: available.available ?? 0,
        status: available.status,
        message: available.message,
      };
    }
    allocatedIds.push(...available.items.map((item) => item.id));
  }
  return { ok: true, allocatedIds };
}
