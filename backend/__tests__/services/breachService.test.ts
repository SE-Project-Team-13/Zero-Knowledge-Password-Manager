import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import crypto from "crypto";
import * as breachService from "../../src/services/breachService.js";

describe("BreachService Integration Test", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should detect a breached email using actual privacy protocol logic", async () => {
    const email = "breached@test.com";
    const hash = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // Create a mock DB provider with proper signature
    const mockGetSuffixes = jest.fn<(prefix: string) => Promise<string[]>>().mockResolvedValue([
      "NON_MATCHING_SUFFIX_1",
      suffix.toUpperCase(),
      "NON_MATCHING_SUFFIX_2",
    ]);

    const mockBreachDB = {
      getSuffixes: mockGetSuffixes
    };

    const isBreached = await breachService.checkEmailBreach(email, mockBreachDB as any);

    expect(mockGetSuffixes).toHaveBeenCalledWith(prefix);
    expect(isBreached).toBe(true);
  });

  it("should return false for a safe email", async () => {
    const email = "secure@test.com";
    const hash = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    const prefix = hash.substring(0, 5);

    const mockGetSuffixes = jest.fn<(prefix: string) => Promise<string[]>>().mockResolvedValue([
      "OTHER_SUFFIX_1",
      "OTHER_SUFFIX_2",
    ]);

    const mockBreachDB = {
      getSuffixes: mockGetSuffixes
    };

    const isBreached = await breachService.checkEmailBreach(email, mockBreachDB as any);

    expect(mockGetSuffixes).toHaveBeenCalledWith(prefix);
    expect(isBreached).toBe(false);
  });
});
