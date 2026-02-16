import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import crypto from "crypto";

const mockGetSuffixes = jest.fn();

jest.unstable_mockModule("../../src/services/mockBreachDb.js", () => ({
    MockBreachDB: {
        getSuffixes: mockGetSuffixes
    }
}));

describe("BreachService Integration Test", () => {
  let checkEmailBreach: any;

  beforeAll(async () => {
      const module = await import("../../src/services/breachService.js");
      checkEmailBreach = module.checkEmailBreach;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    console.log("\n---------------------------------------------------");
  });

  it("should detect a breached email using actual privacy protocol logic", async () => {
    const email = "breached@test.com";
    console.log(`Test Case 1: Checking known breached email: "${email}"`);

    const hash = crypto.createHash("sha256").update(email).digest("hex");
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    console.log(`[Test Setup] Calculated Hash: ${hash}`);

    mockGetSuffixes.mockResolvedValue([
      "NON_MATCHING_SUFFIX_1",
      suffix.toUpperCase(),
      "NON_MATCHING_SUFFIX_2",
    ] as never);

    console.log("[Action] Calling checkEmailBreach()...");
    const isBreached = await checkEmailBreach(email);

    console.log(`[Output] Result Result: ${isBreached}`);

    expect(mockGetSuffixes).toHaveBeenCalledWith(prefix);
    expect(isBreached).toBe(true);
    console.log("Result: Success - Breach correctly detected.");
  });

  it("should return false for a safe email", async () => {
    const email = "secure@test.com";
    console.log(`Test Case 2: Checking safe email: "${email}"`);

    const hash = crypto.createHash("sha256").update(email).digest("hex");
    const prefix = hash.substring(0, 5);

    mockGetSuffixes.mockResolvedValue([
      "OTHER_SUFFIX_1",
      "OTHER_SUFFIX_2",
    ] as never);

    console.log("[Action] Calling checkEmailBreach()...");
    const isBreached = await checkEmailBreach(email);
    console.log(`[Output] Result (expected false): ${isBreached}`);
    
    expect(mockGetSuffixes).toHaveBeenCalledWith(prefix);
    expect(isBreached).toBe(false);
    console.log("Result: Success - Safe email correctly identified.");
  });
});
