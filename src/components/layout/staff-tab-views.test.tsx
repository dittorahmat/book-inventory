import { describe, expect, test } from "bun:test";
import { TAB_IDS } from "./staff-tabs";
import { STAFF_TAB_RENDERERS } from "./staff-tab-views";

describe("staff tab renderers", () => {
  test("setiap ActiveTab punya tepat satu renderer", () => {
    expect(Object.keys(STAFF_TAB_RENDERERS).sort()).toEqual([...TAB_IDS].sort());
  });
});
