import { describe, expect, it } from "bun:test";
import { formatClassroomName } from "./classroom";

describe("classroom helper", () => {
  it("formats classroom name with grade and rombel", () => {
    expect(formatClassroomName("1", "INTER 1")).toBe("1 INTER 1");
    expect(formatClassroomName("2", "MQ 2")).toBe("2 MQ 2");
  });

  it("falls back to Kelas X when rombel is missing or empty", () => {
    expect(formatClassroomName("1", null)).toBe("Kelas 1");
    expect(formatClassroomName("3", "")).toBe("Kelas 3");
    expect(formatClassroomName("5", "   ")).toBe("Kelas 5");
  });
});
