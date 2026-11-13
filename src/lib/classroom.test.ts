import { describe, expect, it } from "bun:test";
import { formatClassroomName, sortRombels } from "./classroom";

describe("classroom helper", () => {
  it("formats classroom name with grade and rombel, and avoids duplication when rombel already has grade", () => {
    expect(formatClassroomName("1", "INTER 1")).toBe("1 INTER 1");
    expect(formatClassroomName("1", "1 INTER 1")).toBe("1 INTER 1");
    expect(formatClassroomName("2", "MQ 2")).toBe("2 MQ 2");
    expect(formatClassroomName("2", "2 MQ 2")).toBe("2 MQ 2");
  });

  it("falls back to Kelas X when rombel is missing or empty", () => {
    expect(formatClassroomName("1", null)).toBe("Kelas 1");
    expect(formatClassroomName("3", "")).toBe("Kelas 3");
    expect(formatClassroomName("5", "   ")).toBe("Kelas 5");
  });

  it("sorts rombels naturally across grades and classes", () => {
    const raw = ["10 INTER 1", "2 INTER 1", "1 INTER 10", "1 INTER 2", "1 INTER 1", "1 MQ 1"];
    expect(sortRombels(raw)).toEqual([
      "1 INTER 1",
      "1 INTER 2",
      "1 INTER 10",
      "1 MQ 1",
      "2 INTER 1",
      "10 INTER 1",
    ]);
  });
});
