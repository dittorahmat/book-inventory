import { describe, it, expect, vi, beforeEach } from "bun:test";
import { fetchStudents } from "./students-api";

describe("fetchStudents API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("meneruskan parameter rombel ke query string saat nilainya diberikan", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as unknown as typeof fetch;

    await fetchStudents({
      schoolId: "school-alw-1",
      status: "active",
      rombel: "1 INTER 2",
      search: "Ahmad",
    });

    expect(capturedUrl).toContain("/api/students");
    expect(capturedUrl).toContain("schoolId=school-alw-1");
    expect(capturedUrl).toContain("status=active");
    expect(capturedUrl).toContain("rombel=1%20INTER%202");
    expect(capturedUrl).toContain("search=Ahmad");
  });

  it("mengabaikan parameter rombel saat nilainya 'all' atau undefined", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as unknown as typeof fetch;

    await fetchStudents({
      schoolId: "school-alw-1",
      rombel: "all",
    });

    expect(capturedUrl).toContain("schoolId=school-alw-1");
    expect(capturedUrl).not.toContain("rombel=");
  });
});
