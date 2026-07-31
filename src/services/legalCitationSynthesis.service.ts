import Anthropic from "@anthropic-ai/sdk";

import type { LegalAuthoritySearchOutput } from "../types/workflow.types.js";

const MODEL = "claude-opus-5";

export interface SynthesisDocument {
  readonly title: string;
  readonly text: string;
}

export interface SynthesisCitation {
  readonly citedText: string;
  readonly documentTitle: string | null;
}

export interface SynthesisResult {
  readonly ok: boolean;
  readonly answer: string;
  readonly citations: readonly SynthesisCitation[];
  readonly error?: string | undefined;
}

const SYSTEM_PROMPT = [
  "당신은 대한민국 법률 정보 제공 보조원입니다.",
  "반드시 제공된 문서(document)의 내용만 근거로 답변하십시오. 당신이 사전에 알고 있는 법률 지식은 절대 인용 근거로 사용하지 마십시오.",
  "제공된 문서에 없는 조문, 판례, 수치, 사실을 지어내지 마십시오.",
  "제공된 문서만으로 답할 수 없는 부분은 그렇게 명시하고, 억지로 결론을 내리지 마십시오.",
  "최종 법률 판단, 승소 보장, 위법 단정을 하지 마십시오. 이 답변은 법률 정보 제공이며 전문가 자문을 대체하지 않습니다.",
].join("\n");

let client: Anthropic | undefined;

function getClient(): Anthropic | undefined {
  if (!process.env.ANTHROPIC_API_KEY) {
    return undefined;
  }

  client ??= new Anthropic();
  return client;
}

export function isLlmSynthesisAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * authoritySearch에서 검색된 법령 조문 원문을 Citations API용 문서로 변환합니다.
 *
 * 판례는 검색 단계에서 제목(사건명)만 확보되고 전문은 없어(get_precedent_text 별도
 * 호출 필요) 근거 문서로 쓰기엔 내용이 얕습니다. 이번 버전에서는 조문 본문이 있는
 * 법령만 문서로 사용하고, 판례는 이후 별도 확장 대상으로 남겨둡니다.
 */
export function buildDocumentsFromAuthoritySearch(
  authoritySearch: LegalAuthoritySearchOutput,
): readonly SynthesisDocument[] {
  const lawData = authoritySearch.lawSearch?.data as { readonly results?: readonly unknown[] } | null;
  const results = lawData?.results ?? [];

  const documents: SynthesisDocument[] = [];
  for (const raw of results) {
    const record = raw as Record<string, unknown>;
    const lawName = typeof record.lawName === "string" ? record.lawName : undefined;
    const articleNo = typeof record.articleNo === "string" ? record.articleNo : undefined;
    const text = typeof record.text === "string" ? record.text : undefined;

    if (lawName && articleNo && text) {
      documents.push({ title: `${lawName} ${articleNo}`, text });
    }
  }

  return documents;
}

/**
 * 검색된 법령 문서를 Anthropic Citations API에 전달해 근거에 묶인(grounded) 답변을
 * 생성합니다. 프롬프트 지시만으로 근거를 강제하지 않고, API 차원에서 응답 문장을
 * 실제 제공 문서의 특정 구절에 연결합니다 — Citations는 구조화 출력(output_config.format)과
 * 함께 쓸 수 없어 이 서비스는 인용이 달린 자유 텍스트를 반환합니다.
 *
 * 이 응답은 1차 방어선입니다. 그래도 모델이 문서에 없는 내용을 인용할 가능성은
 * 남아 있으므로, 호출 측에서 `citationGroundingVerifier.service.ts`의
 * `verifyGeneratedCitations()`로 2차 검증하는 것을 권장합니다.
 */
export async function synthesizeGroundedAnswer(
  question: string,
  documents: readonly SynthesisDocument[],
): Promise<SynthesisResult> {
  const anthropic = getClient();
  if (!anthropic) {
    return { ok: false, answer: "", citations: [], error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." };
  }

  if (documents.length === 0) {
    return { ok: false, answer: "", citations: [], error: "근거 문서가 없어 답변을 생성할 수 없습니다." };
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...documents.map((doc) => ({
              type: "document" as const,
              source: {
                type: "text" as const,
                media_type: "text/plain" as const,
                data: doc.text,
              },
              title: doc.title.slice(0, 240),
              citations: { enabled: true },
            })),
            { type: "text" as const, text: question },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, answer: "", citations: [], error: "안전 정책에 의해 응답이 거부되었습니다." };
    }

    const answerParts: string[] = [];
    const citations: SynthesisCitation[] = [];

    for (const block of response.content) {
      if (block.type !== "text") {
        continue;
      }

      answerParts.push(block.text);
      for (const citation of block.citations ?? []) {
        if (citation.type === "char_location") {
          citations.push({ citedText: citation.cited_text, documentTitle: citation.document_title });
        }
      }
    }

    return { ok: true, answer: answerParts.join(""), citations };
  } catch (error) {
    return {
      ok: false,
      answer: "",
      citations: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
