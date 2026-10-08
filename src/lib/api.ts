/**
 * Kanonik fetch klien: satu-satunya seam HTTP untuk view/hook/komponen.
 * Semua helper melempar Error(pesan server) agar pemanggil selalu menampilkan
 * feedback (anti silent failure). Body error mentah tersedia di
 * `(err as { body?: unknown }).body` untuk kasus khusus (mis. ref dashboard).
 */
export const readJson = async (res: Response, fallback: string): Promise<any> => {
  let data: any = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(fallback);
  }
  if (!res.ok || !data || data.success === false) {
    const err = new Error((data && (data.message || data.error)) || fallback);
    (err as { body?: unknown }).body = data;
    throw err;
  }
  return data;
};

/** Envelope penuh `{ success, message, data, ... }` — untuk flag tambahan (simulated, ref). */
export const apiEnvelope = async <T>(url: string, init?: RequestInit, fallback = "Request gagal."): Promise<T> => {
  const res = await fetch(url, init);
  return (await readJson(res, fallback)) as T;
};

/** Isi `data` dari envelope sukses. */
export const api = async <T>(url: string, init?: RequestInit, fallback = "Request gagal."): Promise<T> => {
  const body = await apiEnvelope<{ data: T }>(url, init, fallback);
  return body.data as T;
};

/** Query string builder: buang param kosong agar URL konsisten di semua view. */
export const buildQuery = (base: string, params: Record<string, string | number | boolean | null | undefined>): string => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${base}?${qs}` : base;
};

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const getJson = <T>(url: string, fallback = "Gagal memuat data."): Promise<T> => api<T>(url, undefined, fallback);

export const postJson = <T>(url: string, body: unknown, fallback = "Request gagal."): Promise<T> =>
  api<T>(url, jsonInit("POST", body), fallback);

export const putJson = <T>(url: string, body: unknown, fallback = "Request gagal."): Promise<T> =>
  api<T>(url, jsonInit("PUT", body), fallback);

export const patchJson = <T>(url: string, body: unknown, fallback = "Request gagal."): Promise<T> =>
  api<T>(url, jsonInit("PATCH", body), fallback);

export const delJson = <T>(url: string, fallback = "Request gagal."): Promise<T> =>
  api<T>(url, { method: "DELETE" }, fallback);

/** Upload FormData (dokumen TTD, bukti transfer, cover) — tanpa header JSON manual. */
export const postForm = <T>(url: string, form: FormData, fallback = "Upload gagal."): Promise<T> =>
  api<T>(url, { method: "POST", body: form }, fallback);
