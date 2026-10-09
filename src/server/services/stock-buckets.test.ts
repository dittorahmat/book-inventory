import { describe, expect, it } from "bun:test";
import {
  ALLOCATABLE_CONDITIONS,
  isAllocatable,
  isDamaged,
  isDisposed,
  isKittable,
  isReturnable,
  KITTABLE_CONDITIONS,
  RETURNABLE_CONDITIONS,
} from "./stock-buckets";

describe("stock-buckets condition seam (T2)", () => {
  it("allocatable admits new and good only", () => {
    expect(isAllocatable("new")).toBe(true);
    expect(isAllocatable("good")).toBe(true);
    expect(isAllocatable("fair")).toBe(false);
    expect(isAllocatable("damaged")).toBe(false);
    expect(isAllocatable("lost")).toBe(false);
    expect([...ALLOCATABLE_CONDITIONS].sort()).toEqual(["good", "new"]);
  });

  it("kittable admits new only", () => {
    expect(isKittable("new")).toBe(true);
    expect(isKittable("good")).toBe(false);
    expect(isKittable("fair")).toBe(false);
    expect(isKittable("damaged")).toBe(false);
    expect(isKittable("lost")).toBe(false);
    expect([...KITTABLE_CONDITIONS]).toEqual(["new"]);
  });

  it("returnable admits new only", () => {
    expect(isReturnable("new")).toBe(true);
    expect(isReturnable("good")).toBe(false);
    expect(isReturnable("fair")).toBe(false);
    expect(isReturnable("damaged")).toBe(false);
    expect(isReturnable("lost")).toBe(false);
    expect([...RETURNABLE_CONDITIONS]).toEqual(["new"]);
  });

  it("damaged and disposed predicates isolate kernel tally rules", () => {
    expect(isDamaged("damaged")).toBe(true);
    expect(isDamaged("new")).toBe(false);
    expect(isDamaged("good")).toBe(false);
    expect(isDamaged("lost")).toBe(false);
    expect(isDisposed("disposed")).toBe(true);
    expect(isDisposed("in_stock")).toBe(false);
    expect(isDisposed("lost")).toBe(false);
  });
});
