import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
import { useUniformOrder } from "./useUniformOrder";

const { renderHook, act, cleanup } = await import("@testing-library/react");

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("useUniformOrder hook API interaction", () => {
  it("forwards query and schoolId as an object to searchUniformStudents", async () => {
    let capturedUrl = "";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      if (capturedUrl.includes("/schools")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ id: "school-alw-1", name: "Al Wildan 1", code: "ALW-1" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "std-uniform-1",
              nis: "2024101001",
              name: "Hendra Wahyudi",
              gender: "male",
              gradeLevel: "1",
              academicYear: "2025/2026",
              status: "promoted",
              schoolId: "school-alw-1",
              schoolName: "Al Wildan 1",
              parentName: "Drs. Wahyudi Pratama",
              parentPhone: "+6281234567890",
              detectedStatus: "naik_kelas",
              currentGradeLevel: "1",
              targetGradeLevel: "2",
              canOrder: true,
              orderBlockedReason: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const { result } = renderHook(() => useUniformOrder());

    await act(async () => {
      await result.current.loadSchools();
    });

    act(() => {
      result.current.setSchoolId("school-alw-1");
      result.current.setQuery("Hendra");
    });

    await act(async () => {
      await result.current.handleSearch();
    });

    expect(capturedUrl).toContain("query=Hendra");
    expect(capturedUrl).toContain("schoolId=school-alw-1");
    expect(capturedUrl).toBe("/api/public/uniform-orders/search-students?query=Hendra&schoolId=school-alw-1");
    expect(result.current.results.length).toBe(1);
    expect(result.current.results[0].name).toBe("Hendra Wahyudi");
  });
});
