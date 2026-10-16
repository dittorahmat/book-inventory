import { like, or, sql, type SQLWrapper } from "drizzle-orm";

/**
 * Satu-satunya pemilik substring pencarian terpartisi (§11 / ADR-0002):
 * pola `%q%` lowercase + kolom `lower()` dibangun di sini, bukan di
 * tiap route. Bentuk SQL yang dihasilkan identik dengan sebelumnya
 * sehingga gate check:plans tetap mengunci bukti SEARCH USING INDEX
 * yang sama. Partisi `school_id = ?` + LIMIT tetap di route.
 */
export const partitionedPattern = (query: string): string => `%${query.trim().toLowerCase()}%`;

export const matchLower = (column: SQLWrapper, query: string): SQLWrapper =>
  like(sql`lower(${column})`, partitionedPattern(query));

export const matchAnyLower = (columns: SQLWrapper[], query: string): SQLWrapper | undefined =>
  columns.length === 0 ? undefined : or(...columns.map((c) => matchLower(c, query)));
