import { DOMAIN_KEYWORDS, DOMAIN_ORDER, LITIGATION_CHECKLISTS } from "./litigationChecklistCatalog.service.js";
import type { DomainClassificationResult, LegalDomain } from "../types/litigationPrep.types.js";

/**
 * 사용자가 어느 분야(형사/민사/가정법원)에 해당하는지 모를 때, 입력 문장의 키워드로
 * 먼저 구체적 사건 유형을, 그다음 분야만이라도 안내합니다. LLM 없이 순수 키워드 매칭이라
 * 매칭되지 않으면 억지로 추측하지 않고 "unclear"로 정직하게 표시합니다.
 */
export function classifyLitigationSituation(situation: string): DomainClassificationResult {
  const normalized = situation.toLowerCase();

  const matchedCaseType = LITIGATION_CHECKLISTS.find((template) =>
    template.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );

  if (matchedCaseType) {
    return {
      domain: matchedCaseType.domain,
      matchedCaseTypeId: matchedCaseType.id,
      confidence: "matched_case_type",
    };
  }

  const matchedDomain = DOMAIN_ORDER.find((domain) =>
    DOMAIN_KEYWORDS[domain].some((keyword) => normalized.includes(keyword.toLowerCase())),
  );

  if (matchedDomain) {
    return { domain: matchedDomain, confidence: "matched_domain_only" };
  }

  return { domain: "unclear", confidence: "unclear" };
}

/** 사용자가 분야를 직접 지정한 경우 키워드 분류보다 우선 적용합니다. */
export function classifyWithExplicitDomain(
  situation: string,
  explicitDomain: LegalDomain | undefined,
): DomainClassificationResult {
  if (!explicitDomain) {
    return classifyLitigationSituation(situation);
  }

  const keywordResult = classifyLitigationSituation(situation);
  if (keywordResult.matchedCaseTypeId && keywordResult.domain === explicitDomain) {
    return keywordResult;
  }

  return { domain: explicitDomain, confidence: "matched_domain_only" };
}
