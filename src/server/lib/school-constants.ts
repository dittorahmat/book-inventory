/**
 * Canonical School Identifiers & Codes (§0.65)
 * Memetakan ID database dan kode sekolah Al Wildan agar kode server,
 * script, dan seeder tidak menggunakan hardcoded string tebakan.
 */

export const SCHOOL_IDS = {
  ALW_1_HQ: "school-alw-1",
  ALW_2: "school-alw-2",
  ALW_3: "school-alw-3",
  ALW_4: "school-alw-4",
  WAREHOUSE: "school-warehouse",
} as const;

export const SCHOOL_CODES = {
  [SCHOOL_IDS.ALW_1_HQ]: "ALW-01-HQ",
  [SCHOOL_IDS.ALW_2]: "ALW-02",
  [SCHOOL_IDS.ALW_3]: "ALW-03",
  [SCHOOL_IDS.ALW_4]: "ALW-04",
  [SCHOOL_IDS.WAREHOUSE]: "GUDANG-LOG",
} as const;
