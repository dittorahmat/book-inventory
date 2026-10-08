import { describe, expect, test } from "bun:test";
import { api, apiEnvelope, buildQuery, getJson, patchJson, postForm, postJson, readJson } from "./api";

const jsonRes = (body: unknown, ok = true, status = 200): Response =>
  new Response(JSON.stringify(body), { status: ok ? status : status, headers: { "Content-Type": "application/json" } });

const stubFetch = (res: Response, seen: { url?: string; init?: RequestInit }) => {
  (globalThis as { fetch?: unknown }).fetch = async (url: string, init?: RequestInit) => {
    seen.url = url;
    seen.init = init;
    return res.clone();
  };
};

describe("canonical fetch seam", () => {
  test("api mengembalikan envelope.data", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    stubFetch(jsonRes({ success: true, data: [1, 2] }), seen);
    await expect(api<number[]>("/api/x")).resolves.toEqual([1, 2]);
    expect(seen.url).toBe("/api/x");
  });

  test("error membawa pesan server + body mentah", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    stubFetch(jsonRes({ success: false, message: "Kode sudah terdaftar", ref: "r1" }, false, 400), seen);
    const err = (await api("/api/x", undefined, "Jatuh").catch((e) => e)) as Error;
    expect(err.message).toBe("Kode sudah terdaftar");
    expect((err as { body?: { ref?: string } }).body?.ref).toBe("r1");
  });

  test("fallback dipakai bila body bukan JSON / kosong", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    stubFetch(new Response("bukan json", { status: 500 }), seen);
    await expect(getJson("/api/x", "Server sibuk.")).rejects.toThrow("Server sibuk.");
  });

  test("postJson mengirim JSON + method POST", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    stubFetch(jsonRes({ success: true, data: { id: "a" } }), seen);
    await postJson<{ id: string }>("/api/x", { name: "b" });
    expect(seen.init?.method).toBe("POST");
    expect(seen.init?.headers).toEqual({ "Content-Type": "application/json" });
  });

  test("patchJson memakai method PATCH", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    stubFetch(jsonRes({ success: true, data: null }), seen);
    await patchJson("/api/x", { name: "b" });
    expect(seen.init?.method).toBe("PATCH");
  });

  test("postForm tidak menyetel Content-Type manual", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    stubFetch(jsonRes({ success: true, data: { url: "u" } }), seen);
    await postForm("/api/x", new FormData());
    expect(seen.init?.method).toBe("POST");
    expect(seen.init?.headers).toBeUndefined();
  });

  test("apiEnvelope memberi akses flag envelope (simulated)", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    stubFetch(jsonRes({ success: true, simulated: true, message: "m", data: { x: 1 } }), seen);
    const body = await apiEnvelope<{ simulated?: boolean; data: { x: number } }>("/api/x");
    expect(body.simulated).toBe(true);
  });

  test("readJson menolak success:false walau status 200", async () => {
    await expect(readJson(jsonRes({ success: false, message: "Ditolak" }), "Jatuh")).rejects.toThrow("Ditolak");
  });

  test("buildQuery membuang param kosong + encode", () => {
    expect(buildQuery("/api/o", { schoolId: "s 1", q: "", page: undefined, n: 2 })).toBe("/api/o?schoolId=s%201&n=2");
    expect(buildQuery("/api/o", {})).toBe("/api/o");
  });
});
