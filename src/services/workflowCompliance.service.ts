import { citationVerifierService, type CaseAuthorityCitation, type LegalAuthorityCitation } from "./citationVerifier.service.js";
import { safetyFilterService } from "./safetyFilter.service.js";
import type {
  LegalAuthoritySearchOutput,
  LegalWorkflowPolicy,
  WorkflowCitationVerification,
  WorkflowSafetyReview,
} from "../types/workflow.types.js";

interface ComplianceInput {
  readonly authoritySearch: LegalAuthoritySearchOutput;
  readonly textParts: readonly string[];
  readonly baseWarnings?: readonly string[];
}

interface ComplianceResult {
  readonly safetyReview: WorkflowSafetyReview;
  readonly citationVerification: WorkflowCitationVerification;
  readonly requiresExpertReview: boolean;
  readonly warnings: readonly string[];
}

function unique(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values));
}

/** 요약 문구가 provider와 무관하게 항상 "개발용" 문구로 고정되지 않도록 실제 출처를 반영합니다. */
export function describeAuthoritySource(provider: LegalAuthoritySearchOutput["provider"]): string {
  return provider === "korean-law"
    ? "한국 법령 검색 제공자의 검색 결과를 기준으로"
    : "개발용 모의 검색 결과를 기준으로";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((record): record is Record<string, unknown> => Boolean(record))
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function extractLegalAuthorities(authoritySearch: LegalAuthoritySearchOutput): LegalAuthorityCitation[] {
  const authorities: LegalAuthorityCitation[] = [];

  const lawSearchData = asRecord(authoritySearch.lawSearch?.data);
  for (const result of asRecordArray(lawSearchData?.results)) {
    authorities.push({
      lawName: asString(result.lawName),
      articleNo: asString(result.articleNo),
      title: asString(result.title),
    });
  }

  const articleData = asRecord(authoritySearch.article?.data);
  if (articleData) {
    authorities.push({
      lawName: asString(articleData.lawName),
      articleNo: asString(articleData.articleNo),
      title: asString(articleData.title),
    });
  }

  return authorities;
}

function extractCaseAuthorities(authoritySearch: LegalAuthoritySearchOutput): CaseAuthorityCitation[] {
  const precedentSearchData = asRecord(authoritySearch.precedentSearch?.data);

  return asRecordArray(precedentSearchData?.results).map((result) => ({
    caseNumber: asString(result.caseNumber),
    decisionDate: asString(result.decisionDate),
    court: asString(result.court),
    title: asString(result.title) ?? asString(result.topic),
  }));
}

export function createComplianceResult(input: ComplianceInput): ComplianceResult {
  const safety = safetyFilterService.filter(input.textParts.join("\n"));
  const citation = citationVerifierService.verify({
    legalAuthorities: extractLegalAuthorities(input.authoritySearch),
    caseAuthorities: extractCaseAuthorities(input.authoritySearch),
  });
  const requiresExpertReview =
    safety.expertReviewRequired ||
    citation.blocksDefinitiveAnalysis ||
    input.authoritySearch.manualReviewRequired;
  const warnings = unique([
    ...(input.baseWarnings ?? []),
    ...(safety.expertReviewRequired ? ["위험 표현이 감지되어 전문가 검토가 필요합니다."] : []),
    ...(citation.limitations.includes("출처 확인 필요") ? ["출처 확인 필요"] : []),
    ...(citation.blocksDefinitiveAnalysis ? ["근거가 부족한 단정적 분석은 제한됩니다."] : []),
  ]);

  return {
    safetyReview: {
      changed: safety.changed,
      expertReviewRequired: safety.expertReviewRequired,
      detections: safety.detections,
    },
    citationVerification: {
      sourceSufficiency: citation.sourceSufficiency,
      limitations: citation.limitations,
      blocksDefinitiveAnalysis: citation.blocksDefinitiveAnalysis,
      missingFields: citation.missingFields,
    },
    requiresExpertReview,
    warnings,
  };
}

export function mergePolicyWithCompliance(
  policy: LegalWorkflowPolicy,
  compliance: ComplianceResult,
): LegalWorkflowPolicy {
  return {
    ...policy,
    requiresExpertReview: policy.requiresExpertReview || compliance.requiresExpertReview,
    warnings: unique([...policy.warnings, ...compliance.warnings]),
  };
}
