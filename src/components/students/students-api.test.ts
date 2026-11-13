import { describe, it, expect, vi, beforeEach } from "bun:test";
import { fetchStudents, fetchSchoolRombels } from "./students-api";

describe("fetchStudents API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("meneruskan parameter rombel, page, limit ke query string saat nilainya diberikan", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: [],
            pagination: { page: 2, limit: 25, total: 100, totalPages: 4 },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    }) as unknown as typeof fetch;

    const res = await fetchStudents({
      schoolId: "school-alw-1",
      status: "active",
      rombel: "1 INTER 2",
      search: "Ahmad",
      page: 2,
      limit: 25,
    });

    expect(capturedUrl).toContain("/api/students");
    expect(capturedUrl).toContain("schoolId=school-alw-1");
    expect(capturedUrl).toContain("status=active");
    expect(capturedUrl).toContain("rombel=1%20INTER%202");
    expect(capturedUrl).toContain("search=Ahmad");
    expect(capturedUrl).toContain("page=2");
    expect(capturedUrl).toContain("limit=25");
    expect(res.pagination?.totalPages).toBe(4);
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

  it("memanggil endpoint /api/students/rombels dengan query schoolId pada fetchSchoolRombels", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: ["1 INTER 1", "2 MQ 1"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as unknown as typeof fetch;

    const rombels = await fetchSchoolRombels("school-alw-1");
    expect(capturedUrl).toContain("/api/students/rombels");
    expect(capturedUrl).toContain("schoolId=school-alw-1");
    expect(rombels).toEqual(["1 INTER 1", "2 MQ 1"]);
  });
});
