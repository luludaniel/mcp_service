import { describe, expect, it } from "vitest";

import { createMcpLegalService } from "./mcpLegal.service.js";

describe("mcpLegalService providers", () => {
  it("returns mock search data from the mock provider", async () => {
    const service = createMcpLegalService("mock");

    const result = await service.searchLaw("unpaid freelance fee");

    expect(service.provider).toBe("mock");
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("mock");
    expect(result.operation).toBe("searchLaw");
    expect(result.manualReviewRequired).toBe(true);
  });

  it("returns both law and precedent lookups from researchAuthorities", async () => {
    const service = createMcpLegalService("mock");

    const { lawSearch, precedentSearch } = await service.researchAuthorities("용역대금 미지급");

    expect(lawSearch.ok).toBe(true);
    expect(lawSearch.operation).toBe("searchLaw");
    expect(precedentSearch.ok).toBe(true);
    expect(precedentSearch.operation).toBe("searchPrecedents");
  });

  it("degrades researchAuthorities to failure metadata when LAW_OC is missing", async () => {
    const originalLawOc = process.env.LAW_OC;
    delete process.env.LAW_OC;

    try {
      const service = createMcpLegalService("korean-law");
      const { lawSearch, precedentSearch } = await service.researchAuthorities("용역대금 미지급");

      for (const result of [lawSearch, precedentSearch]) {
        expect(result.ok).toBe(false);
        expect(result.notices).toContain("검색 실패");
        expect(result.notices).toContain("수동 확인 필요");
      }

      expect(lawSearch.operation).toBe("searchLaw");
      expect(precedentSearch.operation).toBe("searchPrecedents");
    } finally {
      if (originalLawOc === undefined) {
        delete process.env.LAW_OC;
      } else {
        process.env.LAW_OC = originalLawOc;
      }
    }
  });

  it("returns merged authorities from researchGeneralAuthorities for arbitrary queries", async () => {
    const service = createMcpLegalService("mock");

    const result = await service.researchGeneralAuthorities("대금/용역비 미지급");

    expect(result.provider).toBe("mock");
    expect(result.lawSearch?.ok).toBe(true);
    expect(result.precedentSearch?.ok).toBe(true);
    expect(result.manualReviewRequired).toBe(true);
  });

  it("returns non-throwing failure metadata from korean-law provider when LAW_OC is missing", async () => {
    const originalLawOc = process.env.LAW_OC;
    delete process.env.LAW_OC;

    try {
      const service = createMcpLegalService("korean-law");
      const result = await service.searchPrecedents("supplier agreement liability");

      expect(service.provider).toBe("korean-law");
      expect(result.ok).toBe(false);
      expect(result.message).toBe("검색 실패");
      expect(result.notices).toContain("검색 실패");
      expect(result.notices).toContain("수동 확인 필요");
      expect(result.error).toContain("LAW_OC 환경변수");
      expect(result.manualReviewRequired).toBe(true);
    } finally {
      if (originalLawOc === undefined) {
        delete process.env.LAW_OC;
      } else {
        process.env.LAW_OC = originalLawOc;
      }
    }
  });
});
