// Polyfill empty stub for bun:sqlite when bundled for Cloudflare Workers
export class Database {
  constructor() {
    throw new Error("bun:sqlite is not supported in Cloudflare Workers. Use env.DB (D1).");
  }
}
export default { Database };
