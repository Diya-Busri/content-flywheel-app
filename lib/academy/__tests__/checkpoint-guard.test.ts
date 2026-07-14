import { describe, it, expect, vi, beforeEach } from "vitest";

const isAdminMock = vi.fn();
const getDisabledFeaturesMock = vi.fn();

vi.mock("@/lib/is-admin", () => ({
  isAdmin: () => isAdminMock(),
}));
vi.mock("@/lib/feature-flags", () => ({
  getDisabledFeatures: (userId: string) => getDisabledFeaturesMock(userId),
  FEATURE_KEYS: { ACADEMY_UNDERSTANDING_CHECK: "academy_understanding_check" },
}));

// Imported after the mocks so the module under test picks them up.
import { isAcademyCheckpointEnabled } from "@/lib/academy/checkpoint-guard";

describe("isAcademyCheckpointEnabled", () => {
  beforeEach(() => {
    isAdminMock.mockReset();
    getDisabledFeaturesMock.mockReset();
  });

  it("always returns true for the admin account, regardless of flags — no hardcoded identity involved", async () => {
    isAdminMock.mockResolvedValue(true);
    const enabled = await isAcademyCheckpointEnabled("user_admin");
    expect(enabled).toBe(true);
    expect(getDisabledFeaturesMock).not.toHaveBeenCalled(); // admin bypasses flag resolution entirely
  });

  it("returns false for an ordinary user when the beta flag is not explicitly enabled", async () => {
    isAdminMock.mockResolvedValue(false);
    getDisabledFeaturesMock.mockResolvedValue(new Set(["academy_understanding_check"]));
    const enabled = await isAcademyCheckpointEnabled("user_123");
    expect(enabled).toBe(false);
  });

  it("returns true for an ordinary user once the flag is explicitly enabled for them", async () => {
    isAdminMock.mockResolvedValue(false);
    getDisabledFeaturesMock.mockResolvedValue(new Set());
    const enabled = await isAcademyCheckpointEnabled("user_123");
    expect(enabled).toBe(true);
  });
});
