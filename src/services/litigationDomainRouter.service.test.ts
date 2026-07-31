import { describe, expect, it } from "vitest";

import { classifyLitigationSituation, classifyWithExplicitDomain } from "./litigationDomainRouter.service.js";

describe("classifyLitigationSituation", () => {
  it("matches a specific case type when its keywords appear", () => {
    const result = classifyLitigationSituation("프리랜서로 일했는데 용역대금을 못 받았어요.");

    expect(result.confidence).toBe("matched_case_type");
    expect(result.domain).toBe("civil");
    expect(result.matchedCaseTypeId).toBe("civil-unpaid-fee");
  });

  it("matches a criminal case type", () => {
    const result = classifyLitigationSituation("사기를 당해서 고소장을 준비하고 싶습니다.");

    expect(result.confidence).toBe("matched_case_type");
    expect(result.domain).toBe("criminal");
    expect(result.matchedCaseTypeId).toBe("criminal-complaint-prep");
  });

  it("matches a family case type", () => {
    const result = classifyLitigationSituation("남편과 이혼소송을 준비하려고 합니다.");

    expect(result.confidence).toBe("matched_case_type");
    expect(result.domain).toBe("family");
    expect(result.matchedCaseTypeId).toBe("family-divorce-prep");
  });

  it("falls back to domain-only match when no case type keyword hits but a domain keyword does", () => {
    const result = classifyLitigationSituation("친권 문제로 상대방과 다투고 있습니다.");

    expect(result.confidence).toBe("matched_domain_only");
    expect(result.domain).toBe("family");
    expect(result.matchedCaseTypeId).toBeUndefined();
  });

  it("returns unclear instead of guessing when nothing matches", () => {
    const result = classifyLitigationSituation("오늘 날씨가 좋네요.");

    expect(result.confidence).toBe("unclear");
    expect(result.domain).toBe("unclear");
    expect(result.matchedCaseTypeId).toBeUndefined();
  });
});

describe("classifyWithExplicitDomain", () => {
  it("uses the keyword match when the explicit domain agrees with it", () => {
    const result = classifyWithExplicitDomain("용역대금을 못 받았어요.", "civil");

    expect(result.confidence).toBe("matched_case_type");
    expect(result.matchedCaseTypeId).toBe("civil-unpaid-fee");
  });

  it("overrides an unrelated keyword match with the user's explicit domain choice", () => {
    const result = classifyWithExplicitDomain("용역대금을 못 받았어요.", "family");

    expect(result.confidence).toBe("matched_domain_only");
    expect(result.domain).toBe("family");
    expect(result.matchedCaseTypeId).toBeUndefined();
  });

  it("falls back to keyword classification when no explicit domain is given", () => {
    const result = classifyWithExplicitDomain("용역대금을 못 받았어요.", undefined);

    expect(result.confidence).toBe("matched_case_type");
    expect(result.domain).toBe("civil");
  });
});
