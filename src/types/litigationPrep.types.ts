import type {
  BlockedWorkflowOutput,
  LegalAuthoritySearchOutput,
  LegalWorkflowPolicy,
  WorkflowCitationVerification,
  WorkflowSafetyReview,
} from "./workflow.types.js";

export type LegalDomain = "criminal" | "civil" | "family";

export interface LitigationPrepInput {
  readonly situation: string;
  /** 사용자가 직접 분야를 지정하면 키워드 분류보다 우선합니다. */
  readonly domain?: LegalDomain | undefined;
}

export interface LitigationChecklistTemplate {
  readonly id: string;
  readonly domain: LegalDomain;
  readonly label: string;
  /** 이 사건 유형으로 분류하기 위한 키워드입니다. */
  readonly keywords: readonly string[];
  readonly summary: string;
  readonly requiredEvidence: readonly string[];
  readonly requiredDocuments: readonly string[];
  readonly deadlinesAndLimitations: readonly string[];
  readonly jurisdictionNotes: readonly string[];
  readonly preLitigationSteps: readonly string[];
}

export type ClassificationConfidence = "matched_case_type" | "matched_domain_only" | "unclear";

export interface DomainClassificationResult {
  readonly domain: LegalDomain | "unclear";
  readonly matchedCaseTypeId?: string | undefined;
  readonly confidence: ClassificationConfidence;
}

export interface LitigationPrepOutput {
  readonly allowed: true;
  readonly workflow: "litigation_prep";
  readonly summary: string;
  readonly classificationScope: Record<string, string>;
  readonly nextSteps: readonly string[];
  /** 사건 유형이 확정된 경우에만 채워지는 체크리스트입니다. */
  readonly mockResult?: Record<string, unknown> | undefined;
  /** 사건 유형이 확정되지 않은 경우 사용자가 직접 고를 수 있도록 전체 카탈로그를 보여줍니다. */
  readonly browseCatalog?: Record<string, string> | undefined;
  readonly authoritySearch?: LegalAuthoritySearchOutput | undefined;
  readonly safetyReview?: WorkflowSafetyReview | undefined;
  readonly citationVerification?: WorkflowCitationVerification | undefined;
  readonly policy: LegalWorkflowPolicy;
}

export type LitigationPrepWorkflowOutput = LitigationPrepOutput | BlockedWorkflowOutput;
