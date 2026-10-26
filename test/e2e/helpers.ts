import { app } from "../../src/server";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";

/**
 * 1x1 transparent PNG data-URL untuk mock upload bukti transfer / refund komplain.
 */
export const DUMMY_PROOF_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * Helper bersama inisialisasi seed database demo untuk seluruh test suite E2E.
 */
export async function seedDemoDatabase(): Promise<void> {
  mockActor("central_admin", null);
  const seedRes = await app.request("/api/demo/seed", { method: "POST" });
  if (seedRes.status !== 200) {
    const text = await seedRes.text();
    throw new Error(`Demo seed failed with status ${seedRes.status}: ${text}`);
  }
  restoreActor();
}
