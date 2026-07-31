import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CitationGroundingResult {
  readonly checked: boolean;
  /** 법제처 DB에 존재하지 않는 인용이 하나라도 있으면 true입니다. */
  readonly hallucinationDetected: boolean;
  readonly totalCitations: number;
  readonly verifiedCitations: number;
  /** 법제처 DB에서 확인되지 않은 인용(예: "상법 제999조의99")입니다. */
  readonly invalidCitations: readonly string[];
  /** 법령명이 불명확하거나 부분 매칭되어 확인이 더 필요한 인용입니다. 오류로 단정하지 않습니다. */
  readonly uncertainCitations: readonly string[];
  readonly rawOutput: string;
  readonly error?: string | undefined;
}

const EMPTY_RESULT: Omit<CitationGroundingResult, "error"> = {
  checked: false,
  hallucinationDetected: false,
  totalCitations: 0,
  verifiedCitations: 0,
  invalidCitations: [],
  uncertainCitations: [],
  rawOutput: "",
};

/**
 * korean-law CLI의 `verify_citations` 도구로 생성된 텍스트의 조문 인용을
 * 법제처 원문 DB와 직접 대조합니다.
 *
 * 이미 검색해온 결과 집합과만 대조하는 방식(코드로 직접 만든 배열 비교)보다
 * 신뢰할 수 있는 사후 안전장치입니다 — 원천 DB 전체와 대조하므로 우리가
 * 사전에 무엇을 검색했는지와 무관하게 검증됩니다. 라이브 검증 결과, 자연스러운
 * 한국어 문장에서 조문을 여러 개 나열하면("민법 제750조와 제390조") 접속사를
 * 다음 인용에 붙여 잘못 파싱하는 경우가 있어 그런 항목은 "확인 필요"로 분류되고
 * 오류로 단정되지 않습니다 — 이 서비스도 같은 원칙을 따릅니다.
 */
export async function verifyGeneratedCitations(text: string): Promise<CitationGroundingResult> {
  if (!process.env.LAW_OC) {
    return { ...EMPTY_RESULT, error: "LAW_OC 환경변수가 필요합니다." };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ...EMPTY_RESULT, error: "검증할 텍스트가 비어 있습니다." };
  }

  try {
    const { stdout } = await execFileAsync(
      "korean-law",
      ["verify_citations", "--text", trimmed],
      {
        env: { ...process.env, LAW_OC: process.env.LAW_OC },
        timeout: 20_000,
        maxBuffer: 1024 * 1024,
      },
    );

    return parseVerifyCitationsOutput(stdout);
  } catch (error) {
    // 도구는 환각이 감지되면 종료 코드 1을 반환하므로(정상 동작), stdout이 있으면 그대로 파싱합니다.
    const output = (error as { stdout?: string }).stdout;
    if (typeof output === "string" && output.trim().length > 0) {
      return parseVerifyCitationsOutput(output);
    }

    return {
      ...EMPTY_RESULT,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parseVerifyCitationsOutput(stdout: string): CitationGroundingResult {
  const hallucinationDetected = stdout.includes("[HALLUCINATION_DETECTED]");

  const summaryMatch = /총\s*(\d+)건\s*\|\s*✓\s*(\d+)\s*실존/.exec(stdout);
  const totalCitations = summaryMatch?.[1] ? Number(summaryMatch[1]) : 0;
  const verifiedCitations = summaryMatch?.[2] ? Number(summaryMatch[2]) : 0;

  const invalidCitations = Array.from(stdout.matchAll(/^✗\s*(.+?)\s*—/gm))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  const uncertainCitations = Array.from(stdout.matchAll(/^⚠\s*(.+?)\s*—/gm))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return {
    checked: true,
    hallucinationDetected,
    totalCitations,
    verifiedCitations,
    invalidCitations,
    uncertainCitations,
    rawOutput: stdout,
  };
}
