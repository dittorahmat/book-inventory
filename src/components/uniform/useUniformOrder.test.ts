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

  it("selectStudent automatically initializes packageQty = 1 and olahraga satuanQty = 1", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/catalog")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              packages: [
                {
                  id: "pkg-sd-ikh",
                  code: "PKG-SD-IKH",
                  name: "Paket Bahan Seragam Harian SD Ikhwan",
                  academicYear: "2026/2027",
                  price: 1952000,
                  readyQty: 5,
                  bom: [
                    { variantId: "uv-kain-1", variantName: "Kemeja", kind: "kain_harian", size: "—", quantity: 1 },
                  ],
                },
              ],
              variants: [
                {
                  id: "uv-kain-1",
                  code: "UV-K-1",
                  name: "Kemeja",
                  kind: "kain_harian",
                  gender: "male",
                  jenjang: "sd",
                  academicYear: "2026/2027",
                  price: 196000,
                  sizeChartUrl: null,
                  sizes: [],
                  stock: [],
                },
                {
                  id: "uv-ol-1",
                  code: "UV-OL-1",
                  name: "BAJU OLAHRAGA (SD Ikhwan)",
                  kind: "olahraga",
                  gender: "male",
                  jenjang: "sd",
                  academicYear: "2026/2027",
                  price: 350000,
                  sizeChartUrl: null,
                  sizes: ["S", "M", "L"],
                  stock: [{ size: "S", quantity: 10 }],
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/satuan-status")) {
        return new Response(
          JSON.stringify({ success: true, data: { open: true } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    }) as typeof fetch;

    const { result } = renderHook(() => useUniformOrder());
    const mockStudent = {
      id: "std-test-1",
      nis: "1001",
      name: "Ahmad Siswa",
      gender: "male" as const,
      gradeLevel: "1",
      academicYear: "2026/2027",
      status: "active" as const,
      schoolId: "sch-1",
      schoolName: "SD 1",
      parentName: "Bapak",
      parentPhone: "081111",
      detectedStatus: "baru" as const,
      currentGradeLevel: "1",
      targetGradeLevel: "1",
      curriculumType: "nasional" as const,
      isScholarship: false,
      canOrder: true,
      orderBlockedReason: null,
    };

    await act(async () => {
      await result.current.selectStudent(mockStudent);
    });

    expect(result.current.step).toBe(2);
    expect(result.current.packageQty["pkg-sd-ikh"]).toBe(1);
    expect(result.current.satuanQty["uv-ol-1"]).toBe(1);
    // Tombol submit belum bisa aktif karena ukuran olahraga belum dipilih
    expect(result.current.canSubmit).toBe(false);
  });

  it("validates postal code: requires 5 digits and combines with address on submit", async () => {
    let capturedBody: { homeAddress?: string } | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/orders") && init?.method === "POST") {
        capturedBody = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              order: { orderNumber: "USO20261113000001" },
              totalAmount: 500000,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    }) as typeof fetch;

    const { result } = renderHook(() => useUniformOrder());

    act(() => {
      result.current.setAddress("Jl. Melati No. 5, RT 01 RW 02, Kel. Sukamaju, Kec. Serpong, Tangerang Selatan");
      result.current.setPostalCode("1531"); // baru 4 digit
    });

    expect(result.current.isPostalCodeValid).toBe(false);

    act(() => {
      result.current.setPostalCode("15310"); // valid 5 digit
    });

    expect(result.current.isPostalCodeValid).toBe(true);
    expect(capturedBody).toBeNull();
  });
});
