export type LegalWorkflowName = "legal_research" | "contract_review" | "document_drafting";

export interface LegalResearchInput {
  readonly question: string;
  readonly facts?: string | undefined;
  readonly jurisdiction?: string | undefined;
}

export interface ContractReviewInput {
  readonly contractText: string;
  readonly partyRole: string;
  readonly concern?: string | undefined;
}

export interface DocumentDraftInput {
  readonly documentType: string;
  readonly facts: string;
  readonly recipient?: string | undefined;
  readonly requestedOutcome?: string | undefined;
}

export interface LegalWorkflowPolicy {
  readonly informationalOnly: true;
  readonly draftOnly: boolean;
  readonly prohibitsFinalJudgment: true;
  readonly prohibitsGuaranteedOutcome: true;
  readonly prohibitsDefinitiveIllegalityFinding: true;
  readonly requiresExpertReview: boolean;
  readonly disclaimers: readonly string[];
  readonly warnings: readonly string[];
}

export interface LegalLookupResult {
  readonly ok: boolean;
  readonly provider: "mock" | "korean-law";
  readonly operation: "searchLaw" | "searchPrecedents" | "getLawArticle" | "researchQuestion";
  readonly data: unknown | null;
  readonly message: string;
  readonly notices: readonly string[];
  readonly manualReviewRequired: boolean;
  readonly error?: string;
}

export interface LegalAuthoritySearchOutput {
  readonly provider: "mock" | "korean-law";
  readonly lawSearch?: LegalLookupResult;
  readonly precedentSearch?: LegalLookupResult;
  readonly article?: LegalLookupResult;
  readonly notices: readonly string[];
  readonly manualReviewRequired: boolean;
}

export interface WorkflowSafetyReview {
  readonly changed: boolean;
  readonly expertReviewRequired: boolean;
  readonly detections: readonly {
    readonly phrase: string;
    readonly category: string;
    readonly riskLevel: "medium" | "high";
  }[];
}

export interface WorkflowCitationVerification {
  readonly sourceSufficiency: "sufficient" | "partial" | "insufficient";
  readonly limitations: readonly string[];
  readonly blocksDefinitiveAnalysis: boolean;
  readonly missingFields: {
    readonly legalAuthorities: readonly string[];
    readonly caseAuthorities: readonly string[];
  };
}

export interface BlockedWorkflowOutput {
  readonly allowed: false;
  readonly reason: "excluded_education_context";
  readonly policy: LegalWorkflowPolicy;
}

export interface LlmGroundingCheck {
  readonly hallucinationDetected: boolean;
  readonly invalidCitations: readonly string[];
  readonly uncertainCitations: readonly string[];
}

export interface LlmSynthesisOutput {
  readonly used: boolean;
  readonly answer?: string | undefined;
  readonly citations?: readonly { readonly citedText: string; readonly documentTitle: string | null }[] | undefined;
  readonly groundingCheck?: LlmGroundingCheck | undefined;
  readonly notice: string;
}

export interface LegalResearchOutput {
  readonly allowed: true;
  readonly workflow: "legal_research";
  readonly summary: string;
  readonly nextSteps: readonly string[];
  readonly mockResult: {
    readonly issue: string;
    readonly likelySources: readonly string[];
    readonly limitations: readonly string[];
  };
  readonly authoritySearch: LegalAuthoritySearchOutput;
  readonly safetyReview: WorkflowSafetyReview;
  readonly citationVerification: WorkflowCitationVerification;
  readonly llmSynthesis?: LlmSynthesisOutput | undefined;
  readonly policy: LegalWorkflowPolicy;
}

export interface ContractReviewOutput {
  readonly allowed: true;
  readonly workflow: "contract_review";
  readonly summary: string;
  readonly reviewScope: {
    readonly partyRole: string;
    readonly concern: string;
  };
  readonly nextSteps: readonly string[];
  readonly mockResult: {
    readonly riskLevel: "low" | "medium" | "high";
    readonly detectedIssues: readonly string[];
    readonly suggestedReviewPoints: readonly string[];
  };
  readonly authoritySearch: LegalAuthoritySearchOutput;
  readonly safetyReview: WorkflowSafetyReview;
  readonly citationVerification: WorkflowCitationVerification;
  readonly policy: LegalWorkflowPolicy;
}

export interface DocumentDraftOutput {
  readonly allowed: true;
  readonly workflow: "document_drafting";
  readonly summary: string;
  readonly draftScope: {
    readonly documentType: string;
    readonly recipient: string;
    readonly requestedOutcome: string;
  };
  readonly nextSteps: readonly string[];
  readonly mockResult: {
    readonly sections: readonly string[];
    readonly placeholders: readonly string[];
    readonly deliveryChecklist: readonly string[];
  };
  readonly authoritySearch: LegalAuthoritySearchOutput;
  readonly safetyReview: WorkflowSafetyReview;
  readonly citationVerification: WorkflowCitationVerification;
  readonly policy: LegalWorkflowPolicy;
}

export type LegalResearchWorkflowOutput = LegalResearchOutput | BlockedWorkflowOutput;
export type ContractReviewWorkflowOutput = ContractReviewOutput | BlockedWorkflowOutput;
export type DocumentDraftWorkflowOutput = DocumentDraftOutput | BlockedWorkflowOutput;
