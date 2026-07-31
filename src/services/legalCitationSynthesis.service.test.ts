import { describe, expect, it } from "vitest";

import {
  buildDocumentsFromAuthoritySearch,
  isLlmSynthesisAvailable,
  synthesizeGroundedAnswer,
} from "./legalCitationSynthesis.service.js";
import type { LegalAuthoritySearchOutput } from "../types/workflow.types.js";

function authoritySearchWithLawResults(results: readonly unknown[]): LegalAuthoritySearchOutput {
  return {
    provider: "korean-law",
    lawSearch: {
      ok: true,
      provider: "korean-law",
      operation: "searchLaw",
      data: { results },
      message: "검색 완료",
      notices: [],
      manualReviewRequired: true,
    },
    notices: [],
    manualReviewRequired: true,
  };
}

describe("isLlmSynthesisAvailable", () => {
  it("is false when ANTHROPIC_API_KEY is not set", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      expect(isLlmSynthesisAvailable()).toBe(false);
    } finally {
      if (original === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = original;
      }
    }
  });
});

describe("buildDocumentsFromAuthoritySearch", () => {
  it("converts law articles with full text into synthesis documents", () => {
    const authoritySearch = authoritySearchWithLawResults([
      { lawName: "민법", articleNo: "제390조", title: "채무불이행과 손해배상", text: "채무자가..." },
      { lawName: "민법", articleNo: "제750조", title: "불법행위의 내용", text: "고의 또는 과실로..." },
    ]);

    const documents = buildDocumentsFromAuthoritySearch(authoritySearch);

    expect(documents).toEqual([
      { title: "민법 제390조", text: "채무자가..." },
      { title: "민법 제750조", text: "고의 또는 과실로..." },
    ]);
  });

  it("skips entries missing lawName, articleNo, or text", () => {
    const authoritySearch = authoritySearchWithLawResults([
      { lawName: "민법", articleNo: "제390조" }, // text 없음
      { lawName: "민법", text: "본문" }, // articleNo 없음
      { articleNo: "제750조", text: "본문" }, // lawName 없음
    ]);

    expect(buildDocumentsFromAuthoritySearch(authoritySearch)).toEqual([]);
  });

  it("returns an empty array when there is no law search data", () => {
    const authoritySearch: LegalAuthoritySearchOutput = {
      provider: "mock",
      notices: [],
      manualReviewRequired: false,
    };

    expect(buildDocumentsFromAuthoritySearch(authoritySearch)).toEqual([]);
  });
});

describe("synthesizeGroundedAnswer guard clauses (no API key needed)", () => {
  it("fails fast when ANTHROPIC_API_KEY is not set", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const result = await synthesizeGroundedAnswer("질문", [{ title: "민법 제390조", text: "..." }]);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("ANTHROPIC_API_KEY");
    } finally {
      if (original === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = original;
      }
    }
  });

  it("fails fast when there are no documents, even with a key configured", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";

    try {
      const result = await synthesizeGroundedAnswer("질문", []);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("근거 문서");
    } finally {
      if (original === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = original;
      }
    }
  });
});
