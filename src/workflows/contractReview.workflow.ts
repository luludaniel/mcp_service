import { legalWorkflowService } from "../services/legalWorkflow.service.js";
import { mcpLegalService } from "../services/mcpLegal.service.js";
import {
  createComplianceResult,
  describeAuthoritySource,
  mergePolicyWithCompliance,
} from "../services/workflowCompliance.service.js";
import type { ContractReviewInput, ContractReviewWorkflowOutput } from "../types/workflow.types.js";
import { createPolicyResult, hasExcludedEducationContext } from "./policy.js";

export async function contractReviewWorkflow(input: ContractReviewInput): Promise<ContractReviewWorkflowOutput> {
  const context = [input.contractText, input.partyRole, input.concern].filter(Boolean).join(" ");

  if (hasExcludedEducationContext(context)) {
    return {
      allowed: false,
      reason: "excluded_education_context",
      policy: createPolicyResult({ requiresExpertReview: true }),
    };
  }

  const mockResult = legalWorkflowService.createContractReviewMock(input);
  const authoritySearch = await mcpLegalService.reviewContractAuthorities(input);
  const nextSteps = [
    "일방적이거나 모호한 조항을 식별합니다.",
    "법률 및 거래상 위험을 우선순위로 정리합니다.",
    "협상 쟁점과 대체 문구를 초안 제안으로 준비합니다.",
  ];
  const compliance = createComplianceResult({
    authoritySearch,
    textParts: [
      input.contractText,
      input.partyRole,
      input.concern ?? "일반 위험 검토",
      mockResult.riskLevel,
      ...mockResult.detectedIssues,
      ...mockResult.suggestedReviewPoints,
      ...nextSteps,
    ],
    baseWarnings: ["계약 문구 변경안은 서명 또는 전달 전에 전문가 검토가 필요합니다."],
  });
  const policy = mergePolicyWithCompliance(
    createPolicyResult({
      requiresExpertReview: true,
    }),
    compliance,
  );

  return {
    allowed: true,
    workflow: "contract_review",
    summary: `계약서 검토 요청이 접수되었습니다. ${describeAuthoritySource(authoritySearch.provider)} 주요 위험을 정리합니다.`,
    reviewScope: {
      partyRole: input.partyRole,
      concern: input.concern ?? "일반 위험 검토",
    },
    nextSteps,
    mockResult,
    authoritySearch,
    safetyReview: compliance.safetyReview,
    citationVerification: compliance.citationVerification,
    policy,
  };
}

export const runContractReviewWorkflow = contractReviewWorkflow;
