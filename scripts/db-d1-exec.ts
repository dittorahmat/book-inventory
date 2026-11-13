/**
 * Runner CLI untuk eksekusi query remote D1 yang fleksibel:
 * Otomatis menyisipkan flag `--command=` jika input berupa string SQL polos,
 * atau meneruskan argumen langsung ke wrangler d1 execute.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: bun run db:d1:exec \"<SQL_QUERY>\" atau flag wrangler d1 execute");
  process.exit(1);
}

const parsedArgs: string[] = ["run", "wrangler", "d1", "execute", "book-inventory-db", "--remote"];

if (args.length === 1 && !args[0].startsWith("-")) {
  const target = args[0];
  if (target.endsWith(".sql") || existsSync(target)) {
    parsedArgs.push(`--file=${target}`);
  } else {
    parsedArgs.push(`--command=${target}`);
  }
} else {
  parsedArgs.push(...args);
}

const result = spawnSync("bun", parsedArgs, {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 0);
