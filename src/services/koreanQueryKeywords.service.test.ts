import { describe, expect, it } from "vitest";

import {
  extractSearchKeywords,
  filterByRelevance,
  hasTokenOverlap,
  tokenizeKoreanQuery,
} from "./koreanQueryKeywords.service.js";

describe("tokenizeKoreanQuery", () => {
  it("strips trailing request/question endings from a full sentence", () => {
    const tokens = tokenizeKoreanQuery(
      "프리랜서 용역대금을 지급받지 못한 경우 검토할 수 있는 민사 조치를 알려주세요.",
    );

    expect(tokens).not.toContain("알려주세요.");
    expect(tokens.join(" ")).not.toMatch(/알려주세요/);
  });

  it("keeps the core content words from that sentence", () => {
    const tokens = tokenizeKoreanQuery(
      "프리랜서 용역대금을 지급받지 못한 경우 검토할 수 있는 민사 조치를 알려주세요.",
    );

    expect(tokens).toContain("프리랜서");
    expect(tokens.some((t) => t.startsWith("용역대금"))).toBe(true);
    expect(tokens).toContain("민사");
  });

  it("leaves an already-clean keyword phrase basically unchanged", () => {
    const tokens = tokenizeKoreanQuery("채무불이행 손해배상");

    expect(tokens).toEqual(["채무불이행", "손해배상"]);
  });

  it("does not crash or empty out on nonsense input", () => {
    const tokens = tokenizeKoreanQuery("asdf1234 존재하지않는키워드xyz");

    expect(tokens.length).toBeGreaterThan(0);
  });

  it("does not strip short real words that happen to end in a josa-like syllable", () => {
    // 2자 미만 토큰은 조사 제거 대상에서 제외되어야 의미 있는 단어가 사라지지 않는다.
    const tokens = tokenizeKoreanQuery("도로 위 사고");

    expect(tokens).toContain("도로");
  });
});

describe("extractSearchKeywords", () => {
  it("falls back to the original text when tokenization empties everything out", () => {
    const result = extractSearchKeywords("수 등");

    expect(result).toBe("수 등");
  });

  it("returns a shorter, cleaner query for a verbose question", () => {
    const original = "프리랜서 용역대금을 지급받지 못한 경우 검토할 수 있는 민사 조치를 알려주세요.";
    const cleaned = extractSearchKeywords(original);

    expect(cleaned.length).toBeLessThan(original.length);
    expect(cleaned).toContain("프리랜서");
  });
});

describe("hasTokenOverlap", () => {
  it("matches when a query token literally appears in the candidate text", () => {
    const tokens = tokenizeKoreanQuery("채무불이행 손해배상");

    expect(hasTokenOverlap(tokens, "민법 제390조 채무불이행과 손해배상")).toBe(true);
  });

  it("rejects candidates with no shared vocabulary (the real bug this fixes)", () => {
    const tokens = tokenizeKoreanQuery(
      "프리랜서 용역대금을 지급받지 못한 경우 검토할 수 있는 민사 조치를 알려주세요.",
    );

    expect(hasTokenOverlap(tokens, "해양수산부와 그 소속기관 직제 시행규칙 수산정책실")).toBe(false);
  });

  it("treats an empty query token list as unfiltered (avoid over-filtering)", () => {
    expect(hasTokenOverlap([], "anything at all")).toBe(true);
  });
});

describe("filterByRelevance", () => {
  it("drops irrelevant law articles while keeping relevant ones", () => {
    const tokens = tokenizeKoreanQuery("일방적 해지 조항");
    const candidates = [
      { lawName: "민법", title: "해지의 효과" },
      { lawName: "우편법 시행규칙", title: "사서함 사용계약 해지 등" },
      { lawName: "법인세법 시행규칙", title: "서식" },
    ];

    const { kept, droppedCount } = filterByRelevance(
      tokens,
      candidates,
      (item) => `${item.lawName} ${item.title}`,
    );

    expect(kept.map((c) => c.lawName)).toContain("민법");
    expect(droppedCount).toBeGreaterThan(0);
  });

  it("empties out entirely when nothing overlaps (matches the live TC-1 finding)", () => {
    const tokens = tokenizeKoreanQuery("존재하지않는 키워드");
    const candidates = [{ title: "개인정보 보호법 제7조" }, { title: "우체국예금 보험에 관한 법률" }];

    const { kept } = filterByRelevance(tokens, candidates, (item) => item.title);

    expect(kept).toHaveLength(0);
  });
});
