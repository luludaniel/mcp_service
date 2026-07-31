import { verifyGeneratedCitations } from "./citationGroundingVerifier.service.js";
import {
  buildDocumentsFromAuthoritySearch,
  isLlmSynthesisAvailable,
  synthesizeGroundedAnswer,
} from "./legalCitationSynthesis.service.js";
import type { LegalAuthoritySearchOutput, LlmSynthesisOutput } from "../types/workflow.types.js";

function isLlmSynthesisEnabled(): boolean {
  return process.env.LLM_SYNTHESIS_ENABLED === "true" && isLlmSynthesisAvailable();
}

/**
 * 검색된 법령 원문(authoritySearch)을 근거로 LLM 종합 답변을 시도합니다.
 *
 * 이중 안전장치를 씁니다:
 *   1차 — Anthropic Citations API: 답변 생성 자체를 제공 문서의 특정 구절에 묶어(grounding)
 *         모델이 문서에 없는 내용을 지어내기 어렵게 만듭니다.
 *   2차 — korean-law CLI의 verify_citations: 그래도 남을 수 있는 환각을 잡기 위해,
 *         생성된 최종 텍스트를 법제처 원문 DB와 직접 재대조합니다.
 *
 * 2차 검증에서 환각이 감지되면 답변 전체를 폐기합니다(문장 일부만 골라 제거하면
 * 문맥이 깨질 수 있어, 이 프로젝트의 기존 원칙대로 애매하면 확실한 실패로 표시합니다).
 * 비활성화 상태이거나 키가 없으면 항상 안전하게 `used: false`로 폴백하고, 호출 측은
 * 기존 규칙 기반 결과를 그대로 사용하면 됩니다.
 */
export async function attemptLlmSynthesis(
  question: string,
  authoritySearch: LegalAuthoritySearchOutput,
): Promise<LlmSynthesisOutput> {
  if (!isLlmSynthesisEnabled()) {
    return {
      used: false,
      notice: isLlmSynthesisAvailable()
        ? "LLM 종합 답변이 비활성화되어 있습니다(LLM_SYNTHESIS_ENABLED=true로 활성화 가능)."
        : "ANTHROPIC_API_KEY가 설정되지 않아 규칙 기반 결과만 제공합니다.",
    };
  }

  const documents = buildDocumentsFromAuthoritySearch(authoritySearch);
  if (documents.length === 0) {
    return { used: false, notice: "실제 법령 검색 결과가 없어 LLM 종합 답변을 생성하지 않았습니다." };
  }

  const synthesis = await synthesizeGroundedAnswer(question, documents);
  if (!synthesis.ok) {
    return { used: false, notice: `LLM 종합 답변 생성에 실패했습니다: ${synthesis.error ?? "알 수 없는 오류"}` };
  }

  const grounding = await verifyGeneratedCitations(synthesis.answer);

  if (grounding.checked && grounding.hallucinationDetected) {
    return {
      used: false,
      notice: "LLM 답변에서 검증되지 않은 인용이 발견되어 결과를 표시하지 않습니다. 규칙 기반 결과를 참고하세요.",
      groundingCheck: {
        hallucinationDetected: true,
        invalidCitations: grounding.invalidCitations,
        uncertainCitations: grounding.uncertainCitations,
      },
    };
  }

  return {
    used: true,
    answer: synthesis.answer,
    citations: synthesis.citations,
    groundingCheck: grounding.checked
      ? {
          hallucinationDetected: grounding.hallucinationDetected,
          invalidCitations: grounding.invalidCitations,
          uncertainCitations: grounding.uncertainCitations,
        }
      : undefined,
    notice: grounding.checked
      ? "실제 검색된 법령 원문에 근거해 생성됐고, 인용은 법제처 DB로 재검증됐습니다."
      : "실제 검색된 법령 원문에 근거해 생성됐습니다(2차 인용 재검증은 LAW_OC 미설정으로 생략됨).",
  };
}
