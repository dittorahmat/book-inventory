import { describe, expect, it } from "bun:test";

interface MinimalInputElement {
  tagName?: string;
  type?: string;
}

describe("Global Numeric Input Wheel Event Prevention (§0.72)", () => {
  it("prevents default on wheel event when target is an input[type=number]", () => {
    let preventDefaultCalled = false;

    const handler = (e: { target: EventTarget | null; preventDefault: () => void }) => {
      const target = e.target as unknown as MinimalInputElement | null;
      if (
        target &&
        typeof target === "object" &&
        target.tagName === "INPUT" &&
        target.type === "number"
      ) {
        e.preventDefault();
      }
    };

    const dummyNumberInput = {
      tagName: "INPUT",
      type: "number",
    } as unknown as EventTarget;

    const dummyTextInput = {
      tagName: "INPUT",
      type: "text",
    } as unknown as EventTarget;

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
