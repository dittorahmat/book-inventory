import { $ } from "bun";

async function run() {
  console.log("Fetching schools, users, and accounts from book-inventory-db...");

  const fetchRes = await $`bun run wrangler d1 execute book-inventory-db --remote --json --command="SELECT * FROM schools; SELECT * FROM users; SELECT * FROM accounts;"`.quiet();
  
  if (fetchRes.exitCode !== 0) {
    console.error("Gagal mengambil data dari book-inventory-db:", fetchRes.stderr.toString());
    process.exit(1);
  }

  const [schoolsResult, usersResult, accountsResult] = JSON.parse(fetchRes.stdout.toString());

  const schools = schoolsResult.results || [];
  const users = usersResult.results || [];
  const accounts = accountsResult.results || [];

  console.log(`Ditemukan: ${schools.length} schools, ${users.length} users, ${accounts.length} accounts.`);

  const escapeSql = (val: unknown): string => {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "number") return String(val);
    if (typeof val === "boolean") return val ? "1" : "0";
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  const sqlStatements: string[] = [];

  // 1. Schools
  for (const s of schools) {
    sqlStatements.push(
      `INSERT OR REPLACE INTO schools (id, name, code, type, address, phone, created_at, updated_at) VALUES (${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.code)}, ${escapeSql(s.type)}, ${escapeSql(s.address)}, ${escapeSql(s.phone)}, ${escapeSql(s.created_at)}, ${escapeSql(s.updated_at)});`
    );
  }

  // 2. Users
  for (const u of users) {
    sqlStatements.push(
      `INSERT OR REPLACE INTO users (id, name, email, email_verified, image, role, school_id, created_at, updated_at) VALUES (${escapeSql(u.id)}, ${escapeSql(u.name)}, ${escapeSql(u.email)}, ${escapeSql(u.email_verified)}, ${escapeSql(u.image)}, ${escapeSql(u.role)}, ${escapeSql(u.school_id)}, ${escapeSql(u.created_at)}, ${escapeSql(u.updated_at)});`
    );
  }

  // 3. Accounts
  for (const a of accounts) {
    sqlStatements.push(
      `INSERT OR REPLACE INTO accounts (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at) VALUES (${escapeSql(a.id)}, ${escapeSql(a.account_id)}, ${escapeSql(a.provider_id)}, ${escapeSql(a.user_id)}, ${escapeSql(a.access_token)}, ${escapeSql(a.refresh_token)}, ${escapeSql(a.id_token)}, ${escapeSql(a.access_token_expires_at)}, ${escapeSql(a.refresh_token_expires_at)}, ${escapeSql(a.scope)}, ${escapeSql(a.password)}, ${escapeSql(a.created_at)}, ${escapeSql(a.updated_at)});`
    );
  }

  const batchSize = 10;
  for (let i = 0; i < sqlStatements.length; i += batchSize) {
    const chunk = sqlStatements.slice(i, i + batchSize).join(" ");
    console.log(`Mengirim batch ${Math.floor(i / batchSize) + 1} (${Math.min(i + batchSize, sqlStatements.length)}/${sqlStatements.length} statements)...`);
    const insertRes = await $`bun run wrangler d1 execute inv-aw-db --remote -e inv-aw --command=${chunk}`.quiet();
    if (insertRes.exitCode !== 0) {
      console.error("Gagal menyisipkan data ke inv-aw-db:", insertRes.stderr.toString());
      process.exit(1);
    }
  }

  console.log("Penyalinan data RBAC & schools ke inv-aw-db berhasil!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
