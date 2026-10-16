/**
 * Satu-satunya seam bentuk baris CSV transfer seragam: export
 * (packing/ekspedisi) dan import (resi/ongkir) adalah dua arah satu
 * round-trip berkunci NIS — header + normalisasi NIS tinggal di sini
 * agar rename kolom pecah di kedua sisi, bukan diam-diam di satu sisi.
 * Atribusi omzet TIDAK ikut (ADR-0009): modul ini hanya bentuk baris.
 */

/** Kunci round-trip: NIS ternormalisasi (trim). */
export const normalizeCsvNis = (nis: string): string => nis.trim();

export interface UniformShippingCsvRow {
  nis: string;
  resi: string;
  ongkir: number;
}

export const PACKING_CSV_HEADER = ["nama", "nis", "kelas", "jenjang", "size", "gender", "qty", "no_order"] as const;

export const EKSPEDISI_CSV_HEADER = ["nama", "nis", "kontak_ortu", "alamat", "ongkir", "resi", "no_order"] as const;
