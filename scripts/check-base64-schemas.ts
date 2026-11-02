// Gate Base64 Schemas: gagalkan (exit 1) bila schema route Hono mendefinisikan
// field base64 (*Base64, *ProofBase64, dsb.) dengan z.string().optional() polos tanpa
// batas karakter/ukuran (raw unconstrained string), alih-alih memakai base64UploadSchema
// dari src/server/lib/validators.ts atau batas .max(...).
// Melindungi batas memori heap Cloudflare Worker (128MB) dari serangan DoS payload raksasa (§0.49).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = "src/server/routes";
const BASE64_KEY_PATTERN = /(\w*[bB]ase64\w*|\w*Proof\w*)\s*:\s*z\.string\(\)\s*\.optional\(\)/;

interface Offender {
  file: string;
  line: number;
  key: string;
}

const offenders: Offender[] = [];
for (const entry of readdirSync(ROUTES_DIR).sort()) {
  if (!/\.ts$/.test(entry) || /\.test\.ts$/.test(entry)) continue;
  const lines = readFileSync(join(ROUTES_DIR, entry), "utf8").split("\n");
  lines.forEach((text, i) => {
    const match = text.match(BASE64_KEY_PATTERN);
    if (match) {
      offenders.push({ file: `${ROUTES_DIR}/${entry}`, line: i + 1, key: match[1] });
    }
  });
}

if (offenders.length > 0) {
  console.error("Base64-schema gate FAILED — field base64 unconstrained tanpa batas ukuran:");
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  →  key '${o.key}' (gunakan base64UploadSchema dari ../lib/validators)`);
  }
  process.exit(1);
}

console.log("Base64-schema gate OK: seluruh upload base64 route memakai schema berbatas ukuran.");
