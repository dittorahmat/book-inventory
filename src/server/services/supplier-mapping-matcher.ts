import { normalizeBookTitle, tokenizeBookTitle } from "../../lib/isbn";
import type { SheetVendorConfig } from "./supplier-mapping-types";

export interface BookCatalogIndex {
  allBooks: Array<{ id: string; isbn: string | null; title: string; category: string | null }>;
  byIsbn: Map<string, { id: string; isbn: string | null; title: string; category: string | null }>;
  byNorm: Map<string, Array<{ id: string; isbn: string | null; title: string; category: string | null }>>;
  byToken: Map<string, Array<{ id: string; isbn: string | null; title: string; category: string | null }>>;
}

export function buildBookCatalogIndex(
  allBooks: Array<{ id: string; isbn: string | null; title: string; category: string | null }>
): BookCatalogIndex {
  const byIsbn = new Map<string, (typeof allBooks)[0]>();
  const byNorm = new Map<string, Array<(typeof allBooks)[0]>>();
  const byToken = new Map<string, Array<(typeof allBooks)[0]>>();

  for (const b of allBooks) {
    if (b.isbn) {
      const clean = b.isbn.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
      if (clean) byIsbn.set(clean, b);
    }
    const n = normalizeBookTitle(b.title);
    const nList = byNorm.get(n) ?? [];
    nList.push(b);
    byNorm.set(n, nList);

    const t = tokenizeBookTitle(b.title);
    const tList = byToken.get(t) ?? [];
    tList.push(b);
    byToken.set(t, tList);
  }

  return { allBooks, byIsbn, byNorm, byToken };
}

export function matchRowToBook(
  row: unknown[],
  cfg: SheetVendorConfig,
  index: BookCatalogIndex
): { id: string; title: string } | undefined {
  const { byIsbn, byNorm, byToken } = index;

  // Prioritas 1: ISBN
  if (cfg.isbnCol !== undefined && cfg.isbnCol !== null && row[cfg.isbnCol] !== undefined) {
    const rawIsbn = String(row[cfg.isbnCol]).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    if (rawIsbn && byIsbn.has(rawIsbn)) {
      return byIsbn.get(rawIsbn);
    }
  }

  // Prioritas 2: Normalized Title + Jenjang Guard
  if (cfg.titleCol !== null && row[cfg.titleCol]) {
    const rawTitle = String(row[cfg.titleCol]).trim();
    const norm = normalizeBookTitle(rawTitle);
    const candidates = byNorm.get(norm) ?? [];

    if (candidates.length === 1) {
      return candidates[0];
    }
    if (candidates.length > 1 && cfg.gradeCol !== undefined && cfg.gradeCol !== null && row[cfg.gradeCol]) {
      const rawGrade = String(row[cfg.gradeCol]).trim().toUpperCase();
      const matchedByGrade = candidates.find(
        (c) =>
          (c.isbn && c.isbn.toUpperCase().includes(rawGrade)) ||
          (c.category && c.category.toUpperCase().includes(rawGrade))
      );
      if (matchedByGrade) return matchedByGrade;
    }
  }

  // Prioritas 3: Token-Set Match
  if (cfg.titleCol !== null && row[cfg.titleCol]) {
    const rawTitle = String(row[cfg.titleCol]).trim();
    const tok = tokenizeBookTitle(rawTitle);
    const candidates = byToken.get(tok) ?? [];
    if (candidates.length === 1) {
      return candidates[0];
    }
    if (candidates.length > 1 && cfg.gradeCol !== undefined && cfg.gradeCol !== null && row[cfg.gradeCol]) {
      const rawGrade = String(row[cfg.gradeCol]).trim().toUpperCase();
      const matchedByGrade = candidates.find(
        (c) =>
          (c.isbn && c.isbn.toUpperCase().includes(rawGrade)) ||
          (c.category && c.category.toUpperCase().includes(rawGrade))
      );
      if (matchedByGrade) return matchedByGrade;
    }
  }

  return undefined;
}
