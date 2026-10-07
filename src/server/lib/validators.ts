import { z } from "zod";

/** Kanonik identifier longgar: kompatibel slug demo (school-alw-1) maupun UUID v4. Jangan pakai z.string().uuid(). */
export const idSchema = z.string().min(1);

export const optionalText = z.string().optional();

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal wajib YYYY-MM-DD");

export const academicYearSchema = z.string().regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran wajib YYYY/YYYY");
