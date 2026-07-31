import { mcpLegalService } from "../services/mcpLegal.service.js";
import {
  buildCatalogIndex,
  DOMAIN_LABELS,
  getChecklistById,
} from "../services/litigationChecklistCatalog.service.js";
import { classifyWithExplicitDomain } from "../services/litigationDomainRouter.service.js";
import { createComplianceResult, mergePolicyWithCompliance } from "../services/workflowCompliance.service.js";
import type { LitigationPrepInput, LitigationPrepWorkflowOutput } from "../types/litigationPrep.types.js";
import { createPolicyResult, hasExcludedEducationContext } from "./policy.js";

const GENERIC_NEXT_STEPS = [
  "상황을 조금 더 구체적으로 입력하거나, 아래 목록에서 해당하는 분야를 직접 선택합니다.",
  "형사/민사/가정법원 중 어느 절차인지 확실하지 않다면 대한법률구조공단 또는 변호사 상담을 먼저 받는 것을 권장합니다.",
];

export async function litigationPrepWorkflow(input: LitigationPrepInput): Promise<LitigationPrepWorkflowOutput> {
  if (hasExcludedEducationContext(input.situation)) {
    return {
      allowed: false,
      reason: "excluded_education_context",
      policy: createPolicyResult({ requiresExpertReview: true }),
    };
  }

  const classification = classifyWithExplicitDomain(input.situation, input.domain);
  const checklist = classification.matchedCaseTypeId ? getChecklistById(classification.matchedCaseTypeId) : undefined;

  if (!checklist) {
    const domainLabel = classification.domain === "unclear" ? "판단 어려움" : DOMAIN_LABELS[classification.domain];

    return {
      allowed: true,
      workflow: "litigation_prep",
      summary:
        classification.confidence === "matched_domain_only"
          ? `${domainLabel} 관련 사안으로 보이지만, 어떤 사건 유형인지는 아직 확정되지 않았습니다. 아래 목록에서 해당하는 사건 유형을 선택하세요.`
          : "입력하신 내용만으로는 어느 분야에 해당하는지 판단하기 어렵습니다. 아래 목록에서 해당하는 분야를 직접 선택하거나 상황을 더 구체적으로 입력해 주세요.",
      classificationScope: {
        분야: domainLabel,
        신뢰도: classification.confidence === "matched_domain_only" ? "분야만 확인됨" : "확인되지 않음",
      },
      nextSteps: GENERIC_NEXT_STEPS,
      browseCatalog: buildCatalogIndex(),
      policy: createPolicyResult({ requiresExpertReview: true }),
    };
  }

  const authoritySearch = await mcpLegalService.researchGeneralAuthorities(checklist.label);
  const compliance = createComplianceResult({
    authoritySearch,
    textParts: [
      checklist.summary,
      ...checklist.requiredEvidence,
      ...checklist.requiredDocuments,
      ...checklist.deadlinesAndLimitations,
      ...checklist.jurisdictionNotes,
      ...checklist.preLitigationSteps,
    ],
    baseWarnings: [
      "이 체크리스트는 일반적인 절차 안내이며 사안별 세부 요건은 다를 수 있어 전문가 확인이 필요합니다.",
    ],
  });
  const policy = mergePolicyWithCompliance(
    createPolicyResult({ requiresExpertReview: true }),
    compliance,
  );

  return {
    allowed: true,
    workflow: "litigation_prep",
    summary: `${DOMAIN_LABELS[checklist.domain]} · ${checklist.label} 사건으로 분류되었습니다. ${checklist.summary}`,
    classificationScope: {
      분야: DOMAIN_LABELS[checklist.domain],
      "사건 유형": checklist.label,
      신뢰도: "사건 유형까지 확인됨",
    },
    nextSteps: [...checklist.preLitigationSteps],
    mockResult: {
      requiredEvidence: checklist.requiredEvidence,
      requiredDocuments: checklist.requiredDocuments,
      deadlinesAndLimitations: checklist.deadlinesAndLimitations,
      jurisdictionNotes: checklist.jurisdictionNotes,
    },
    authoritySearch,
    safetyReview: compliance.safetyReview,
    citationVerification: compliance.citationVerification,
    policy,
  };
}

export const runLitigationPrepWorkflow = litigationPrepWorkflow;
