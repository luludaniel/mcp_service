import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseVerifyCitationsOutput, verifyGeneratedCitations } from "./citationGroundingVerifier.service.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("verifyGeneratedCitations guard clauses", () => {
  it("returns checked:false when LAW_OC is missing, without invoking the CLI", async () => {
    const originalLawOc = process.env.LAW_OC;
    delete process.env.LAW_OC;

    try {
      const result = await verifyGeneratedCitations("민법 제750조");

      expect(result.checked).toBe(false);
      expect(result.error).toContain("LAW_OC");
    } finally {
      if (originalLawOc === undefined) {
        delete process.env.LAW_OC;
      } else {
        process.env.LAW_OC = originalLawOc;
      }
    }
  });

  it("rejects empty text without invoking the CLI", async () => {
    process.env.LAW_OC = "test-key";

    const result = await verifyGeneratedCitations("   ");

    expect(result.checked).toBe(false);
    expect(result.error).toContain("비어");
  });
});

describe("parseVerifyCitationsOutput (real captured CLI output)", () => {
  it("detects HALLUCINATION_DETECTED and extracts the specific invalid citations", () => {
    const result = parseVerifyCitationsOutput(readFixture("verify-citations-hallucination.txt"));

    expect(result.checked).toBe(true);
    expect(result.hallucinationDetected).toBe(true);
    expect(result.totalCitations).toBe(3);
    expect(result.verifiedCitations).toBe(1);
    expect(result.invalidCitations).toEqual(["상법 제999조의99", "형법 제9999조"]);
    expect(result.uncertainCitations).toEqual([]);
  });

  it("marks a single real citation as verified with no hallucination", () => {
    const result = parseVerifyCitationsOutput(readFixture("verify-citations-single-valid.txt"));

    expect(result.checked).toBe(true);
    expect(result.hallucinationDetected).toBe(false);
    expect(result.totalCitations).toBe(1);
    expect(result.verifiedCitations).toBe(1);
    expect(result.invalidCitations).toEqual([]);
  });

  it("never leaks an API key even if one were present in the raw output", () => {
    const result = parseVerifyCitationsOutput(readFixture("verify-citations-hallucination.txt"));

    expect(JSON.stringify(result)).not.toContain("luludaniel");
  });
});
