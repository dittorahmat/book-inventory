import type { MiddlewareHandler } from "hono";

/**
 * Timing khusus endpoint pencarian (§11): ukur durasi handler, sisipkan
 * `meta.tookMs` ke envelope sukses berbentuk `{ success: true, data: [] }`,
 * dan tulis satu baris JSON ke console agar masuk Workers Logs
 * (jatah Free: 200rb events/hari — 1 search = 1 event).
 * Non-GET dan body non-array dilewati tanpa error.
 */
export const searchTiming = (): MiddlewareHandler => async (c, next) => {
  if (c.req.method !== "GET") return next();
  const t0 = performance.now();
  await next();
  const ms = Math.max(0, Math.round(performance.now() - t0));
  let rows: number | null = null;
  try {
    const body = await c.res.clone().json();
    if (body && body.success === true && Array.isArray(body.data)) {
      rows = body.data.length;
      c.res = new Response(JSON.stringify({ ...body, meta: { tookMs: ms } }), c.res);
    }
  } catch {
    // Body non-JSON: meta dilewati, log tetap jalan.
  }
  console.log(
    JSON.stringify({
      src: "search-timing",
      route: c.req.path,
      status: c.res.status,
      ms,
      rows,
      ...(c.req.query("schoolId") ? { schoolId: c.req.query("schoolId") } : {}),
    })
  );
};
