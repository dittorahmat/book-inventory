import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
import type { SchoolOption } from "../../lib/portal-types";
import { useStudentSearch } from "./useStudentSearch";

const { renderHook, act, cleanup } = await import("@testing-library/react");

const dummySchools: SchoolOption[] = [
  { id: "school-alw-1", name: "Al Wildan 1", code: "ALW-1" },
  { id: "school-alw-2", name: "Al Wildan 2", code: "ALW-2" },
];

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("useStudentSearch hook parameter order", () => {
  it("forwards query and schoolId in correct order to searchStudents", async () => {
    let capturedUrl = "";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "std-hendra-1",
              nis: "2024101001",
              name: "Hendra Wahyudi",
              gender: "male",
              gradeLevel: "1",
              curriculumType: "international",
              academicYear: "2025/2026",
              status: "promoted",
              isScholarship: false,
              schoolId: "school-alw-1",
              schoolName: "Al Wildan 1",
              parentName: "Drs. Wahyudi Pratama",
              parentEmail: "wahyudi.pratama@gmail.com",
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

    let error: string | null = null;
    const { result } = renderHook(() =>
      useStudentSearch({
        schools: dummySchools,
        onSelectStudent: () => {},
        onError: (msg) => {
          error = msg;
        },
      })
    );

    // Default school should be seeded to first school
    expect(result.current.searchSchoolId).toBe("school-alw-1");

    // Set search query to "Hendra"
    act(() => {
      result.current.setSearchQuery("Hendra");
    });

    // Execute search
    await act(async () => {
      await result.current.handleSearch({ preventDefault: () => {} } as React.FormEvent);
    });

    // Verify that the requested URL query params match query=Hendra and schoolId=school-alw-1
    expect(capturedUrl).toContain("query=Hendra");
    expect(capturedUrl).toContain("schoolId=school-alw-1");
    expect(capturedUrl).toBe("/api/public/orders/search-students?query=Hendra&schoolId=school-alw-1");
    expect(result.current.searchResults.length).toBe(1);
    expect(result.current.searchResults[0].name).toBe("Hendra Wahyudi");
    expect(error).toBeNull();
  });
});
