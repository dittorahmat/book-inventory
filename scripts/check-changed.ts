// Satu loop gate untuk file yang berubah, dipakai pre-commit (--staged) dan
// `check:fast` (working tree). Tujuannya: loop cepat tidak pernah lebih longgar
// dari pre-commit — kasus nyata `check:dead` ada di pre-commit tetapi tidak di
// `check:fast`, sehingga export mati lolos sampai `check:all`.
import { execFileSync } from "node:child_process";

const staged = process.argv.includes("--staged");
const eslintCommand = ["bun", "x", "eslint"];

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" });
const lines = (...args: string[]): string[] =>
  git(...args)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\\/g, "/"));

const changed = staged
  ? lines("diff", "--cached", "--name-only", "--diff-filter=ACM")
  : [...new Set([
      ...lines("diff", "--name-only", "--diff-filter=ACM"),
      ...lines("diff", "--cached", "--name-only", "--diff-filter=ACM"),
      ...lines("ls-files", "--others", "--exclude-standard"),
    ])];

const has = (pattern: RegExp): boolean => changed.some((file) => pattern.test(file));
const tsFiles = changed.filter((file) => /\.(ts|tsx)$/.test(file));

const run = (command: string[]): void => {
  console.log(`\n> ${command.join(" ")}`);
  execFileSync(command[0], command.slice(1), { stdio: "inherit" });
};

const runBun = (script: string): void => run(["bun", "run", script]);

console.log(
  `Gate file berubah (${staged ? "staged" : "working"}): ${changed.length} file.`
);

// Lint mengikuti mode: staged hanya file TS yang berubah, working tree seluruh repo.
if (staged) {
  if (tsFiles.length > 0) run([...eslintCommand, ...tsFiles]);
} else {
  runBun("lint");
}

runBun("type-check");
runBun("check:imports");
runBun("check:api-contract");
runBun("check:lanes");

if (has(/^src\//)) {
  runBun("check:clean-artifacts");
  runBun("check:file-size");
  runBun("check:no-any");
  runBun("check:canonical-helpers");
  runBun("check:dead");
  runBun("check:doc-numbers");
  runBun("check:single-writer");
  runBun("check:string-packing");
  runBun("check:no-silent-catch");
}

if (has(/^(src\/server\/|src\/db\/|drizzle\/)/)) {
  runBun("check:route-tests");
  if (has(/^src\/server\/routes\//)) {
    run(["bun", "scripts/check-route-tests.ts", "--diff"]);
  }
  runBun("check:validators");
  runBun("check:d1-writes");
  runBun("check:d1-error-mapping");
  runBun("check:plans");
}

if (has(/^drizzle\/.*\.sql$/)) {
  try {
    runBun("check:d1-drift");
  } catch {
    console.warn("\n[WARNING] check:d1-drift gagal dijalankan (mungkin belum ada koneksi D1 remote). Pastikan remote D1 tersinkronisasi sebelum deploy.");
  }
}

if (has(/^(src\/.*\.test\.tsx?$|src\/test-dom|test\/|bunfig\.toml)/)) {
  runBun("check:test-isolation");
}

console.log("\nGate file berubah OK.");
