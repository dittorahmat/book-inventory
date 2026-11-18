export interface SupplierSummaryItem {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  sheet: string;
  isNew: boolean;
}

export interface SupplierMappingResult {
  suppliersUpserted: number;
  booksMatched: number;
  newLinksCount: number;
  totalSheetsProcessed: number;
  processedSuppliers: SupplierSummaryItem[];
}

export interface SupplierPreviewSummaryItem extends SupplierSummaryItem {
  booksMatchedCount: number;
  sampleBooks: string[];
}

export interface SupplierMappingPreviewResult {
  totalSheetsFound: number;
  totalSheetsProcessed: number;
  totalBooksMatched: number;
  suppliers: SupplierPreviewSummaryItem[];
}

export interface SheetVendorConfig {
  sheet: string;
  supCode: string;
  supName: string;
  startRow: number;
  titleCol: number;
  isbnCol?: number | null;
  gradeCol?: number | null;
}

export const DEFAULT_VENDOR_CONFIGS: SheetVendorConfig[] = [
  { sheet: "CNL", supCode: "SUP-CNL", supName: "Chandra Naya Laksana (CNL)", startRow: 10, titleCol: 2, isbnCol: 1 },
  { sheet: "Mentari", supCode: "SUP-MENTARI", supName: "Mentari Books", startRow: 9, titleCol: 2, isbnCol: 1 },
  { sheet: "PELANGI", supCode: "SUP-PELANGI", supName: "Pelangi Books", startRow: 8, titleCol: 1, isbnCol: null, gradeCol: 2 },
  { sheet: "ERLANGGA", supCode: "SUP-ERLANGGA", supName: "Penerbit Erlangga", startRow: 8, titleCol: 4, isbnCol: null, gradeCol: 1 },
  { sheet: "DARSYAFII", supCode: "SUP-DARSYAFII", supName: "Dar Syafii", startRow: 8, titleCol: 2, isbnCol: null },
  { sheet: "BUKU UMUM SURAHMAN", supCode: "SUP-SEGARA", supName: "CV Segara Makmur", startRow: 7, titleCol: 1, isbnCol: null },
  { sheet: "QC & TAHSIN", supCode: "SUP-SEGARA", supName: "CV Segara Makmur", startRow: 7, titleCol: 1, isbnCol: null },
  { sheet: "NAHWU DAN KHAT ABDURRAHMAN", supCode: "SUP-DAKWAH", supName: "Yayasan Dakwah & Taklim", startRow: 7, titleCol: 1, isbnCol: null },
];
