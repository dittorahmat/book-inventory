import { describe, expect, it, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { systemSettings } from "../../db/schema";
import {
  DEMO_STOCK_OVERRIDE_KEY,
  isDemoStockOverrideEnabled,
  setDemoStockOverrideEnabled,
  assertDemoStockOverrideActive,
  DemoStockOverrideDisabledError,
} from "./demo-stock-override";

describe("demo-stock-override service", () => {
  beforeEach(async () => {
    await db.delete(systemSettings).where(eq(systemSettings.key, DEMO_STOCK_OVERRIDE_KEY));
  });

  it("defaults to false when setting row does not exist", async () => {
    const enabled = await isDemoStockOverrideEnabled(db);
    expect(enabled).toBe(false);
  });

  it("updates setting to true and reads back correctly", async () => {
    const res = await setDemoStockOverrideEnabled(db, true);
    expect(res.enabled).toBe(true);

    const enabled = await isDemoStockOverrideEnabled(db);
    expect(enabled).toBe(true);
  });

  it("updates setting back to false correctly", async () => {
    await setDemoStockOverrideEnabled(db, true);
    expect(await isDemoStockOverrideEnabled(db)).toBe(true);

    await setDemoStockOverrideEnabled(db, false);
    expect(await isDemoStockOverrideEnabled(db)).toBe(false);
  });

  it("assertDemoStockOverrideActive throws when disabled and succeeds when enabled", async () => {
    expect(assertDemoStockOverrideActive(db)).rejects.toThrow(DemoStockOverrideDisabledError);

    await setDemoStockOverrideEnabled(db, true);
    expect(assertDemoStockOverrideActive(db)).resolves.toBeUndefined();
  });
});
