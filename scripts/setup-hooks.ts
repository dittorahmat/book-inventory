// Pasang git hooks repo (scripts/githooks/*) tanpa dependensi baru:
// `bun scripts/setup-hooks.ts`. Idempoten — aman dijalankan ulang.
// (Disengaja tanpa husky: menambah devDependency memaksa tulis ulang
// bun.lock, yang dilarang AGENTS.md aturan 5 bila bukan via bun@1.2.15.)
import { execSync } from "node:child_process";

execSync("git config core.hooksPath scripts/githooks", { stdio: "inherit" });
console.log("Git hooks terpasang dari scripts/githooks (pre-commit: type-check + gates file).");
