/**
 * 자연어 질문을 korean-law CLI에 보내기 전 다듬고, 반환된 결과가 질문과
 * 실제로 관련 있는지 가볍게 검증한다.
 *
 * 배경: `chain_full_research`는 패턴이 매칭되지 않으면 임베딩 기반 "AI 법령검색"으로
 * 폴백하는데, 이 폴백은 항상 10건을 반환하며 관련성이 전혀 없어도 성공/실패를
 * 구분하는 신호를 주지 않는다(라이브 검증 완료, `route.reason`도 신뢰할 수 없음 —
 * 정확한 결과와 무관한 결과가 동일하게 "패턴 미매칭"으로 나오는 경우를 확인함).
 * 키워드를 다듬어도 CLI 폴백 자체의 관련성 품질은 보장되지 않으므로, 반환된
 * 결과와 질문 사이의 단어 겹침을 사후에 확인하는 것이 실질적인 안전장치다.
 */

const SENTENCE_ENDING_PATTERNS: readonly RegExp[] = [
  /\s*(?:해\s*주세요|알려\s*주세요|부탁\s*드립니다|부탁\s*드려요)\.?\??$/,
  /\s*(?:하고\s*싶습니다|하고\s*싶어요|싶습니다|싶어요)\.?\??$/,
  /\s*(?:있(?:나요|습니까|을까요))\??$/,
  /\s*(?:인가요|일까요|하나요|되나요)\??$/,
  /\s*(?:습니다|합니다|입니다|됩니다)\.?$/,
  /\?+$/,
  /\.+$/,
];

const STOPWORD_PHRASES: readonly string[] = [
  "경우에는",
  "경우",
  "관련하여",
  "대하여",
  "대해서",
  "대해",
  "수 있는",
  "수 있나요",
  "할 수 있는",
  "그리고",
  "또한",
];

// 토큰 끝에서만 제거한다. 긴 접미사를 먼저 검사해야 짧은 접미사에 잘못 매칭되지 않는다.
const JOSA_SUFFIXES: readonly string[] = [
  "으로부터", "에게서", "에서는", "이라는",
  "에서", "에게", "한테", "까지", "부터", "이나", "으로", "이라",
  "은", "는", "이", "가", "을", "를", "의", "과", "와", "도", "만", "로", "나", "에",
];

const STOPWORD_TOKENS = new Set(["수", "등", "및", "그", "이", "저", "것"]);

function stripSentenceEnding(text: string): string {
  for (const pattern of SENTENCE_ENDING_PATTERNS) {
    if (pattern.test(text)) {
      return text.replace(pattern, "");
    }
  }
  return text;
}

function stripJosa(token: string): string {
  // 조사 제거로 의미 있는 짧은 단어(2자 미만)가 사라지지 않도록 최소 길이를 둔다.
  if (token.length < 3) {
    return token;
  }

  for (const suffix of JOSA_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 2) {
      return token.slice(0, token.length - suffix.length);
    }
  }

  return token;
}

/** 질문 문장을 검색에 쓸 토큰 목록으로 정규화한다. 순서/중복을 보존한다. */
export function tokenizeKoreanQuery(text: string): readonly string[] {
  let normalized = stripSentenceEnding(text.trim());

  for (const phrase of STOPWORD_PHRASES) {
    normalized = normalized.split(phrase).join(" ");
  }

  normalized = normalized.replace(/[.,!?"'()[\]{}]/g, " ");

  return normalized
    .split(/\s+/)
    .map((token) => stripJosa(token))
    .filter((token) => token.length >= 2 && !STOPWORD_TOKENS.has(token));
}

/** CLI에 실제로 보낼 정제된 질의 문자열. 정제 결과가 비면 원문을 그대로 쓴다. */
export function extractSearchKeywords(text: string): string {
  const tokens = tokenizeKoreanQuery(text);
  return tokens.length > 0 ? tokens.join(" ") : text;
}

/** queryTokens 중 하나라도 candidateText에 등장하면 관련 있다고 판단한다. */
export function hasTokenOverlap(queryTokens: readonly string[], candidateText: string): boolean {
  if (queryTokens.length === 0) {
    // 비교할 토큰이 없으면 걸러낼 근거가 없으므로 안전하게 관련 있다고 본다.
    return true;
  }

  return queryTokens.some((token) => candidateText.includes(token));
}

export interface RelevanceFilterResult<T> {
  readonly kept: readonly T[];
  readonly droppedCount: number;
}

/**
 * 질문 토큰과 겹치지 않는 후보를 제거한다. 겹침이 없으면 인용 검증기가
 * 이미 "출처 부족"으로 판정하도록 결과를 비워 안전한 쪽으로 기운다.
 */
export function filterByRelevance<T>(
  queryTokens: readonly string[],
  candidates: readonly T[],
  getText: (item: T) => string,
): RelevanceFilterResult<T> {
  const kept = candidates.filter((item) => hasTokenOverlap(queryTokens, getText(item)));
  return { kept, droppedCount: candidates.length - kept.length };
}
