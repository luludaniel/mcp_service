import { describe, expect, it } from "vitest";

import { createComplianceResult, describeAuthoritySource } from "./workflowCompliance.service.js";
import type { LegalAuthoritySearchOutput } from "../types/workflow.types.js";

const baseAuthoritySearch: LegalAuthoritySearchOutput = {
  provider: "mock",
  lawSearch: {
    ok: true,
    provider: "mock",
    operation: "searchLaw",
    data: {
      results: [
        {
          lawName: "민법",
          articleNo: "제390조",
          title: "채무불이행과 손해배상",
        },
      ],
    },
    message: "개발용 모의 검색 결과",
    notices: ["실제 법령 및 판례는 수동 확인 필요"],
    manualReviewRequired: true,
  },
  precedentSearch: {
    ok: true,
    provider: "mock",
    operation: "searchPrecedents",
    data: {
      results: [
        {
          court: "대법원",
          topic: "계약상 채무불이행 판례 검색 필요",
        },
      ],
    },
    message: "개발용 모의 검색 결과",
    notices: ["실제 법령 및 판례는 수동 확인 필요"],
    manualReviewRequired: true,
  },
  notices: ["실제 법령 및 판례는 수동 확인 필요"],
  manualReviewRequired: true,
};

describe("workflowComplianceService", () => {
  it("detects risky legal wording and marks expert review required", () => {
    const result = createComplianceResult({
      authoritySearch: baseAuthoritySearch,
      textParts: ["이 사안은 반드시 승소 가능합니다."],
    });

    expect(result.safetyReview.expertReviewRequired).toBe(true);
    expect(result.safetyReview.detections.map((detection) => detection.phrase)).toContain("반드시 승소");
    expect(result.requiresExpertReview).toBe(true);
    expect(result.warnings).toContain("위험 표현이 감지되어 전문가 검토가 필요합니다.");
  });

  it("marks citation limitations when precedent identifiers are incomplete", () => {
    const result = createComplianceResult({
      authoritySearch: baseAuthoritySearch,
      textParts: ["계약상 채무불이행 검토"],
    });

    expect(result.citationVerification.sourceSufficiency).toBe("partial");
    expect(result.citationVerification.limitations).toContain("출처 확인 필요");
    expect(result.citationVerification.blocksDefinitiveAnalysis).toBe(true);
    expect(result.warnings).toContain("출처 확인 필요");
  });
});

describe("describeAuthoritySource", () => {
  it("describes the mock provider as a mock source, not a generic dev placeholder", () => {
    expect(describeAuthoritySource("mock")).toContain("모의");
  });

  it("describes the korean-law provider as a real search source, not mock wording", () => {
    const description = describeAuthoritySource("korean-law");

    expect(description).toContain("한국 법령");
    expect(description).not.toContain("모의");
    expect(description).not.toContain("개발용");
  });
});
