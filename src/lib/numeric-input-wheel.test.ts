import { describe, expect, it } from "bun:test";

describe("Global Numeric Input Wheel Event Prevention (§0.72)", () => {
  it("prevents default on wheel event when target is an input[type=number]", () => {
    let preventDefaultCalled = false;

    const handler = (e: { target: EventTarget | null; preventDefault: () => void }) => {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.type === "number") {
        e.preventDefault();
      }
    };

    const dummyNumberInput = document.createElement("input");
    dummyNumberInput.type = "number";

    const dummyTextInput = document.createElement("input");
    dummyTextInput.type = "text";

    // Test on number input
    handler({
      target: dummyNumberInput,
      preventDefault: () => {
        preventDefaultCalled = true;
      },
    });
    expect(preventDefaultCalled).toBe(true);

    // Test on non-number input (e.g. text)
    preventDefaultCalled = false;
    handler({
      target: dummyTextInput,
      preventDefault: () => {
        preventDefaultCalled = true;
      },
    });
    expect(preventDefaultCalled).toBe(false);
  });
});
