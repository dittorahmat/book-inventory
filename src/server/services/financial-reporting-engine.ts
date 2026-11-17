import { quoteCsvCell } from "./reporting/sales-kernel";

/**
 * Deep Module: FinancialReportingEngine
 * Menyediakan utilitas serialisasi CSV dengan quote escaping terstandar,
 * kalkulasi omzet, serta pembuatan tabel laporan keuangan seragam dan buku.
 */
export function buildCsvDocument(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map((h) => quoteCsvCell(h)).join(",");
  const dataLines = rows.map((row) =>
    row.map((cell) => quoteCsvCell(cell === null || cell === undefined ? "" : cell)).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
}

export interface FinancialMetricTotals {
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
}

export function computeFinancialTotals(
  rows: Array<{ orderCount?: number; quantity?: number; revenue?: number; collected?: number; outstanding?: number }>
): FinancialMetricTotals {
  return rows.reduce<FinancialMetricTotals>(
    (acc, row) => ({
      orderCount: acc.orderCount + (row.orderCount ?? 0),
      totalQuantity: acc.totalQuantity + (row.quantity ?? 0),
      totalRevenue: acc.totalRevenue + (row.revenue ?? 0),
      totalCollected: acc.totalCollected + (row.collected ?? 0),
      totalOutstanding: acc.totalOutstanding + (row.outstanding ?? 0),
    }),
    {
      orderCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
      totalCollected: 0,
      totalOutstanding: 0,
    }
  );
}

