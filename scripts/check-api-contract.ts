// API-contract gate: setiap literal path "/api/..." yang dipanggil klien wajib
// menunjuk route yang benar-benar didaftarkan server.
//
// Latar (Okt 2026): form refund publik menembak `/api/public/orders/students`
// (tidak ada; route sebenarnya `/search-students`) dan `POST
// /api/student-orders/returns` (khusus staf → 401). Semua gate lain hijau —
// `check:route-tests` hanya memeriksa file route punya test, `check:dead` hanya
// export. Fitur itu mati seminggu tanpa alarm.
//
// Sumber kebenaran: `app.route(prefix, router)` + `router.<method>("path")`
// (termasuk `router.route()` bersarang). Pengecualian yang sah didaftarkan di
// REGISTERED_EXCEPTIONS beserta alasannya, pola yang sama dengan
// REGISTERED_SEARCH_SOURCES di scripts/explain-plan.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";

const SERVER_INDEX = "src/server/index.ts";
const ROUTES_DIR = "src/server/routes";
const CLIENT_ROOTS = ["src/components", "src/views", "src/lib", "src/App.tsx"];
const REGISTERED_EXCEPTIONS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^\/api\/auth\//, reason: "ditangani handler better-auth (app.on), bukan route Hono biasa" },
  { pattern: /^\/api\/media\//, reason: "wildcard aset R2: app.get('/api/media/*') di index.ts" },
];

interface RouteEdge {
  prefix: string;
  child: string;
}

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const normalize = (path: string): string => {
  const collapsed = `/${path}`.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
};

const read = (file: string): string => readFileSync(file, "utf8");

// 1. Router → jalur miliknya, plus mounting bersarang (router.route).
const routerPaths = new Map<string, string[]>();
const routerMounts = new Map<string, RouteEdge[]>();
const ROUTE_CALL = /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)["'`]/g;
const MOUNT_CALL = /\b([A-Za-z_$][\w$]*)\.route\(\s*["'`]([^"'`]+)["'`]\s*,\s*([A-Za-z_$][\w$]*)/g;

for (const file of walk(ROUTES_DIR)) {
  if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
  const source = read(file);
  for (const match of source.matchAll(ROUTE_CALL)) {
    const [, router, , path] = match;
    routerPaths.set(router, [...(routerPaths.get(router) ?? []), normalize(path)]);
  }
  for (const match of source.matchAll(MOUNT_CALL)) {
    const [, router, prefix, child] = match;
    routerMounts.set(router, [...(routerMounts.get(router) ?? []), { prefix: normalize(prefix), child }]);
  }
}

// 2. index.ts: mount router di bawah prefix + route literal langsung.
const indexSource = read(SERVER_INDEX);
const rootMounts: RouteEdge[] = [];
for (const match of indexSource.matchAll(
  /\bapp\.route\(\s*["'`]([^"'`]+)["'`]\s*,\s*([A-Za-z_$][\w$]*)/g
)) {
  rootMounts.push({ prefix: normalize(match[1]), child: match[2] });
}
const registered = new Set<string>();
const DIRECT_ROUTE = /\bapp\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)["'`]/g;
for (const match of indexSource.matchAll(DIRECT_ROUTE)) registered.add(normalize(match[2]));
for (const match of indexSource.matchAll(/\bapp\.on\([^)]*?["'`]([^"'`]+)["'`]/g)) {
  registered.add(normalize(match[1]));
}

const collect = (router: string, base: string, seen: Set<string>): void => {
  if (seen.has(router)) return;
  seen.add(router);
  for (const path of routerPaths.get(router) ?? []) registered.add(normalize(`${base}/${path}`));
  for (const mount of routerMounts.get(router) ?? []) {
    collect(mount.child, `${base}/${mount.prefix}`, seen);
  }
};

for (const mount of rootMounts) collect(mount.child, mount.prefix, new Set());

if (registered.size === 0) {
  console.error("API-contract gate GAGAL: tidak ada route terdaftar yang terbaca (parser rusak?).");
  process.exit(1);
}

// 3. Literal /api/... di klien. Template literal dipotong di `${`, sehingga
// path parsial dicocokkan sebagai prefix.
const CLIENT_LITERAL = /\/api\/[A-Za-z0-9_\-:./]*/g;
// Portal publik hanya boleh memanggil permukaan publik: memakai endpoint staf
// adalah cacat senyap kedua dari insiden yang sama (401 di browser ortu).
const PUBLIC_SURFACE = /^src[\\/](components[\\/]portal|views[\\/]Public)/;
const PUBLIC_SURFACE_EXCEPTIONS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^\/api\/auth\//, reason: "sesi better-auth dipakai portal untuk cek login staf" },
  { pattern: /^\/api\/media\//, reason: "URL aset R2 (foto bukti) yang dirender portal" },
];
const files = CLIENT_ROOTS.flatMap((root) =>
  statSync(root).isDirectory() ? walk(root) : [root]
).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file));

interface Finding {
  file: string;
  line: number;
  path: string;
}

const matched = (clientPath: string): boolean => {
  const client = normalize(clientPath);
  for (const route of registered) {
    if (route === client) return true;
    if (route.startsWith(`${client}/`)) return true;
    if (client.startsWith(`${route}/`)) return true;
    const segments = route.split("/");
    const clientSegments = client.split("/");
    if (segments.length >= clientSegments.length) {
      const fits = clientSegments.every(
        (segment, index) => segments[index] === segment || segments[index].startsWith(":") || segments[index] === "*"
      );
      if (fits) return true;
    }
  }
  return false;
};

const findings: Finding[] = [];
for (const file of files) {
  const source = read(file);
  source.split("\n").forEach((line, index) => {
    for (const match of line.matchAll(CLIENT_LITERAL)) {
      const path = match[0];
      if (REGISTERED_EXCEPTIONS.some((exception) => exception.pattern.test(path))) continue;
      if (!matched(path)) {
        findings.push({ file, line: index + 1, path });
        continue;
      }
      const publicSurface = PUBLIC_SURFACE.test(file.replace(/\\/g, "/"));
      const allowed = path.startsWith("/api/public/") ||
        PUBLIC_SURFACE_EXCEPTIONS.some((exception) => exception.pattern.test(path));
      if (publicSurface && !allowed) findings.push({ file, line: index + 1, path });
    }
  });
}

if (findings.length > 0) {
  console.error("API-contract gate GAGAL: path klien tanpa route terdaftar, atau portal publik memanggil endpoint staf:");
  for (const finding of findings) {
    console.error(`  - ${finding.file}:${finding.line} → ${finding.path}`);
  }
  console.error(
    "Perbaiki path-nya, atau daftarkan pengecualian beralasan di REGISTERED_EXCEPTIONS (scripts/check-api-contract.ts)."
  );
  process.exit(1);
}

console.log(
  `API-contract gate OK: ${files.length} file klien, semua literal /api/... cocok dengan ${registered.size} route terdaftar.`
);
