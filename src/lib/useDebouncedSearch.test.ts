import "../test-dom";
import { describe, it, expect } from "bun:test";
import { useDebouncedSearch } from "./useDebouncedSearch";

const { renderHook, act } = await import("@testing-library/react");

describe("useDebouncedSearch", () => {
  it("mengembalikan query pencarian seketika dan menunda debouncedSearch sebesar delay", async () => {
    const { result } = renderHook(() => useDebouncedSearch("", 50));

    expect(result.current.searchQuery).toBe("");
    expect(result.current.debouncedSearch).toBe("");

    act(() => {
      result.current.setSearchQuery("al-wildan");
    });

    expect(result.current.searchQuery).toBe("al-wildan");
    expect(result.current.debouncedSearch).toBe("");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(result.current.debouncedSearch).toBe("al-wildan");
  });
});
