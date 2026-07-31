import { describe, expect, it } from "vitest";

import { attemptLlmSynthesis } from "./legalAnswerSynthesis.service.js";
import type { LegalAuthoritySearchOutput } from "../types/workflow.types.js";

const authoritySearchWithArticle: LegalAuthoritySearchOutput = {
  provider: "korean-law",
  lawSearch: {
    ok: true,
    provider: "korean-law",
    operation: "searchLaw",
    data: { results: [{ lawName: "민법", articleNo: "제390조", title: "채무불이행과 손해배상", text: "채무자가..." }] },
    message: "검색 완료",
    notices: [],
    manualReviewRequired: true,
  },
  notices: [],
  manualReviewRequired: true,
};

const authoritySearchWithoutArticles: LegalAuthoritySearchOutput = {
  provider: "mock",
  notices: [],
  manualReviewRequired: false,
};

describe("attemptLlmSynthesis", () => {
  it("safely falls back with used:false when LLM_SYNTHESIS_ENABLED is not set", async () => {
    const originalFlag = process.env.LLM_SYNTHESIS_ENABLED;
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.LLM_SYNTHESIS_ENABLED;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const result = await attemptLlmSynthesis("질문", authoritySearchWithArticle);

      expect(result.used).toBe(false);
      expect(result.notice).toContain("ANTHROPIC_API_KEY");
    } finally {
      if (originalFlag === undefined) delete process.env.LLM_SYNTHESIS_ENABLED;
      else process.env.LLM_SYNTHESIS_ENABLED = originalFlag;
      if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("stays disabled even with a key if LLM_SYNTHESIS_ENABLED is not 'true'", async () => {
    const originalFlag = process.env.LLM_SYNTHESIS_ENABLED;
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.LLM_SYNTHESIS_ENABLED;
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";

    try {
      const result = await attemptLlmSynthesis("질문", authoritySearchWithArticle);

      expect(result.used).toBe(false);
      expect(result.notice).toContain("비활성화");
    } finally {
      if (originalFlag === undefined) delete process.env.LLM_SYNTHESIS_ENABLED;
      else process.env.LLM_SYNTHESIS_ENABLED = originalFlag;
      if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("does not call the LLM when there are no law article documents to ground on", async () => {
    const originalFlag = process.env.LLM_SYNTHESIS_ENABLED;
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.LLM_SYNTHESIS_ENABLED = "true";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";

    try {
      const result = await attemptLlmSynthesis("질문", authoritySearchWithoutArticles);

      expect(result.used).toBe(false);
      expect(result.notice).toContain("법령 검색 결과가 없어");
    } finally {
      if (originalFlag === undefined) delete process.env.LLM_SYNTHESIS_ENABLED;
      else process.env.LLM_SYNTHESIS_ENABLED = originalFlag;
      if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });
});
