import { z } from "zod";

/** Kanonik identifier longgar: kompatibel slug demo (school-alw-1) maupun UUID v4. Jangan pakai z.string().uuid(). */
export const idSchema = z.string().min(1);

export const academicYearSchema = z.string().regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran wajib YYYY/YYYY");
