/** Shared fetch helper: throws Error(server message) so callers always surface feedback (anti silent failure). */
export const readJson = async (res: Response, fallback: string): Promise<any> => {
  let data: any = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(fallback);
  }
  if (!res.ok || !data || data.success === false) throw new Error((data && (data.message || data.error)) || fallback);
  return data;
};

export const api = async <T>(url: string, init?: RequestInit, fallback = "Request gagal."): Promise<T> => {
  const res = await fetch(url, init);
  const data = await readJson(res, fallback);
  return data.data as T;
};

export const postJson = <T>(url: string, body: unknown, fallback = "Request gagal."): Promise<T> =>
  api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, fallback);
