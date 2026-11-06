import { describe, expect, it } from "bun:test";
import {
  assemblePackage,
  disassemblePackage,
  removePackage,
  unbundleAll,
  updatePackageBOM,
} from "./index";

describe("package deep lifecycle seam (Ticket 05)", () => {
  it("exposes canonical package lifecycle methods at a single seam", () => {
    expect(assemblePackage).toBeDefined();
    expect(disassemblePackage).toBeDefined();
    expect(updatePackageBOM).toBeDefined();
    expect(removePackage).toBeDefined();
    expect(unbundleAll).toBeDefined();
  });
});
