import { normalizeBookTitle, tokenizeBookTitle } from "../../lib/isbn";
import type { SheetVendorConfig } from "./supplier-mapping-types";

export interface BookCatalogIndex {
  allBooks: Array<{ id: string; isbn: string | null; title: string; category: string | null }>;
  byIsbn: Map<string, { id: string; isbn: string | null; title: string; category: string | null }>;
  byNorm: Map<string, Array<{ id: string; isbn: string | null; title: string; category: string | null }>>;
  byToken: Map<string, Array<{ id: string; isbn: string | null; title: string; category: string | null }>>;
  byCanonicalPrime: Map<string, { id: string; isbn: string | null; title: string; category: string | null }>;
}

export function extractPrimeMathSignature(title: string): string | null {
  const upper = title.toUpperCase().replace(/[^A-Z0-9]/g, " ");
  // Cek apakah judul mengandung PR1ME atau PRIME serta MATH atau MATHS
  const hasPrime = /\b(PRIME|PR1ME)\b/.test(upper);
  const hasMath = /\b(MATH|MATHS)\b/.test(upper);
  if (!hasPrime || !hasMath) return null;

  // Ekstrak level (1A..6B)
  const levelMatch = upper.match(/\b([1-6]\s*[AB])\b/);
  if (!levelMatch) return null;
  const level = levelMatch[1].replace(/\s+/g, "");

  // Tentukan tipe: COURSEBOOK vs PRACTICE BOOK / WORKBOOK
  let bookType: "CB" | "PB" | null = null;
  if (upper.includes("COURSEBOOK") || upper.includes("COURSE BK")) {
    bookType = "CB";
  } else if (
    upper.includes("PRACTICE") ||
    upper.includes("WORKBOOK") ||
    /\bWB\b/.test(upper) ||
    /\bPB\b/.test(upper)
  ) {
    bookType = "PB";
  }

  if (!bookType) return null;
  return `PRIME_MATH_${level}_${bookType}`;
}

export function buildBookCatalogIndex(
  allBooks: Array<{ id: string; isbn: string | null; title: string; category: string | null }>
): BookCatalogIndex {
  const byIsbn = new Map<string, (typeof allBooks)[0]>();
  const byNorm = new Map<string, Array<(typeof allBooks)[0]>>();
  const byToken = new Map<string, Array<(typeof allBooks)[0]>>();
  const byCanonicalPrime = new Map<string, (typeof allBooks)[0]>();

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

    const primeSig = extractPrimeMathSignature(b.title);
    if (primeSig && !byCanonicalPrime.has(primeSig)) {
      byCanonicalPrime.set(primeSig, b);
    }
  }

  return { allBooks, byIsbn, byNorm, byToken, byCanonicalPrime };
}

export function matchRowToBook(
  row: unknown[],
  cfg: SheetVendorConfig,
  index: BookCatalogIndex
): { id: string; title: string } | undefined {
  const { byIsbn, byNorm, byToken, byCanonicalPrime } = index;

  // Prioritas 1: ISBN
  if (cfg.isbnCol !== undefined && cfg.isbnCol !== null && row[cfg.isbnCol] !== undefined) {
    const rawIsbn = String(row[cfg.isbnCol]).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    if (rawIsbn && byIsbn.has(rawIsbn)) {
      return byIsbn.get(rawIsbn);
    }
  }

  if (cfg.titleCol !== null && row[cfg.titleCol]) {
    const rawTitle = String(row[cfg.titleCol]).trim();

    // Prioritas 2: Signature Match untuk Seri Prime Math (PR1ME/PRIME MATH/MATHS + Level 1A-6B + Coursebook/Practice/Workbook)
    const primeSig = extractPrimeMathSignature(rawTitle);
    if (primeSig && byCanonicalPrime.has(primeSig)) {
      return byCanonicalPrime.get(primeSig);
    }

    // Prioritas 3: Normalized Title + Jenjang Guard
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

    // Prioritas 4: Token-Set Match
    const tok = tokenizeBookTitle(rawTitle);
    const tokenCandidates = byToken.get(tok) ?? [];
    if (tokenCandidates.length === 1) {
      return tokenCandidates[0];
    }
    if (tokenCandidates.length > 1 && cfg.gradeCol !== undefined && cfg.gradeCol !== null && row[cfg.gradeCol]) {
      const rawGrade = String(row[cfg.gradeCol]).trim().toUpperCase();
      const matchedByGrade = tokenCandidates.find(
        (c) =>
          (c.isbn && c.isbn.toUpperCase().includes(rawGrade)) ||
          (c.category && c.category.toUpperCase().includes(rawGrade))
      );
      if (matchedByGrade) return matchedByGrade;
    }
  }

  return undefined;
}
