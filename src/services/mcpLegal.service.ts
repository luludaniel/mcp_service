import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  ContractReviewInput,
  DocumentDraftInput,
  LegalResearchInput,
} from "../types/workflow.types.js";
import {
  asQueryEnvelope,
  parseArticleText,
  parseLawSearchText,
  parsePrecedentSearchText,
  parseResearchChainText,
  redactApiKey,
} from "./koreanLawParser.service.js";
import {
  extractSearchKeywords,
  filterByRelevance,
  tokenizeKoreanQuery,
} from "./koreanQueryKeywords.service.js";

const execFileAsync = promisify(execFile);

export type LegalProvider = "mock" | "korean-law";
export type LegalLookupOperation =
  | "searchLaw"
  | "searchPrecedents"
  | "getLawArticle"
  | "researchQuestion";

export interface AuthorityLookupPair {
  readonly lawSearch: LegalLookupResult;
  readonly precedentSearch: LegalLookupResult;
}

export interface LegalLookupResult<TData = unknown> {
  readonly ok: boolean;
  readonly provider: LegalProvider;
  readonly operation: LegalLookupOperation;
  readonly data: TData | null;
  readonly message: string;
  readonly notices: readonly string[];
  readonly manualReviewRequired: boolean;
  readonly error?: string;
}

export interface LegalAuthoritySearchResult {
  readonly provider: LegalProvider;
  readonly lawSearch?: LegalLookupResult;
  readonly precedentSearch?: LegalLookupResult;
  readonly article?: LegalLookupResult;
  readonly notices: readonly string[];
  readonly manualReviewRequired: boolean;
}

export interface LegalSearchProvider {
  searchLaw(query: string): Promise<LegalLookupResult>;
  searchPrecedents(query: string): Promise<LegalLookupResult>;
  getLawArticle(lawName: string, articleNo: string): Promise<LegalLookupResult>;
  /**
   * 자연어 질문으로 법령/판례 근거를 함께 조회합니다.
   *
   * `search_law`는 법제처 API의 AND 키워드 검색이라 문장을 그대로 넘기면 항상 결과가 없습니다.
   * 자연어 입력은 라우팅이 가능한 경로로 처리해야 실제 근거를 얻을 수 있습니다.
   */
  researchAuthorities(question: string): Promise<AuthorityLookupPair>;
}

export interface McpLegalService extends LegalSearchProvider {
  readonly provider: LegalProvider;
  researchLegalAuthorities(request: LegalResearchInput): Promise<LegalAuthoritySearchResult>;
  reviewContractAuthorities(request: ContractReviewInput): Promise<LegalAuthoritySearchResult>;
  draftDocumentAuthorities(request: DocumentDraftInput): Promise<LegalAuthoritySearchResult>;
}

function getConfiguredProvider(): LegalProvider {
  return process.env.LEGAL_PROVIDER === "korean-law" ? "korean-law" : "mock";
}

function manualFailure(
  provider: LegalProvider,
  operation: LegalLookupOperation,
  error: unknown,
): LegalLookupResult {
  return {
    ok: false,
    provider,
    operation,
    data: null,
    message: "검색 실패",
    notices: ["검색 실패", "수동 확인 필요"],
    manualReviewRequired: true,
    // CLI stderr에는 인증키가 포함된 링크가 섞일 수 있어 그대로 노출하지 않습니다.
    error: redactApiKey(error instanceof Error ? error.message : String(error)),
  };
}

function mockSuccess<TData>(
  operation: LegalLookupOperation,
  data: TData,
  message = "개발용 모의 검색 결과",
): LegalLookupResult<TData> {
  return {
    ok: true,
    provider: "mock",
    operation,
    data,
    message,
    notices: ["개발용 모의 검색 제공자 결과입니다.", "실제 법령 및 판례는 수동 확인 필요"],
    manualReviewRequired: true,
  };
}

function mergeAuthorityResults(
  provider: LegalProvider,
  results: {
    readonly lawSearch?: LegalLookupResult;
    readonly precedentSearch?: LegalLookupResult;
    readonly article?: LegalLookupResult;
  },
): LegalAuthoritySearchResult {
  const lookups = [results.lawSearch, results.precedentSearch, results.article].filter(
    (result): result is LegalLookupResult => Boolean(result),
  );
  const notices = Array.from(new Set(lookups.flatMap((result) => result.notices)));
  const manualReviewRequired = lookups.some((result) => result.manualReviewRequired || !result.ok);

  return {
    provider,
    ...results,
    notices,
    manualReviewRequired,
  };
}

class MockLegalProvider implements LegalSearchProvider {
  async searchLaw(query: string): Promise<LegalLookupResult> {
    return mockSuccess("searchLaw", {
      query,
      results: [
        {
          lawName: "민법",
          articleNo: "제390조",
          title: "채무불이행과 손해배상",
        },
        {
          lawName: "민법",
          articleNo: "제750조",
          title: "불법행위의 내용",
        },
      ],
    });
  }

  async searchPrecedents(query: string): Promise<LegalLookupResult> {
    return mockSuccess("searchPrecedents", {
      query,
      results: [
        {
          court: "대법원",
          topic: "계약상 채무불이행 및 손해배상 관련 판례 검색 필요",
        },
      ],
    });
  }

  async getLawArticle(lawName: string, articleNo: string): Promise<LegalLookupResult> {
    return mockSuccess("getLawArticle", {
      lawName,
      articleNo,
      text: "개발용 모의 조문입니다. 실제 조문은 한국 법령 검색 제공자 또는 법제처 원문으로 확인해야 합니다.",
    });
  }

  async researchAuthorities(question: string): Promise<AuthorityLookupPair> {
    const [lawSearch, precedentSearch] = await Promise.all([
      this.searchLaw(question),
      this.searchPrecedents(question),
    ]);

    return { lawSearch, precedentSearch };
  }
}

const CLI_SUCCESS_NOTICE = "한국 법령 CLI 검색 결과입니다. 인용 전 원문 확인이 필요합니다.";

function cliSuccess<TData>(operation: LegalLookupOperation, data: TData): LegalLookupResult<TData> {
  return {
    ok: true,
    provider: "korean-law",
    operation,
    data,
    message: "검색 완료",
    notices: [CLI_SUCCESS_NOTICE],
    manualReviewRequired: true,
  };
}

function cliEmpty(operation: LegalLookupOperation, rawText: string): LegalLookupResult {
  return {
    ok: false,
    provider: "korean-law",
    operation,
    data: { rawText },
    message: "검색 실패",
    notices: ["검색 실패", "수동 확인 필요"],
    manualReviewRequired: true,
  };
}

class KoreanLawCliProvider implements LegalSearchProvider {
  private readonly command = "korean-law";

  async searchLaw(query: string): Promise<LegalLookupResult> {
    return this.run("searchLaw", ["search_law", "--query", query], (stdout) => {
      const entries = parseLawSearchText(stdout);
      if (entries.length === 0) {
        return cliEmpty("searchLaw", redactApiKey(stdout));
      }

      // 법령명 검색은 조문 단위 근거를 제공하지 않으므로 articleNo는 비워 둡니다.
      // 인용 검증기는 이를 근거 부족으로 판단해야 정확합니다.
      return cliSuccess("searchLaw", {
        query,
        results: entries.map((entry) => ({
          lawName: entry.lawName,
          lawId: entry.lawId,
          mst: entry.mst,
          promulgationDate: entry.promulgationDate,
          lawType: entry.lawType,
          matchType: entry.matchType,
        })),
      });
    });
  }

  async searchPrecedents(query: string): Promise<LegalLookupResult> {
    return this.run("searchPrecedents", ["search_precedents", "--query", query], (stdout) => {
      const entries = parsePrecedentSearchText(stdout);
      if (entries.length === 0) {
        return cliEmpty("searchPrecedents", redactApiKey(stdout));
      }

      return cliSuccess("searchPrecedents", { query, results: entries });
    });
  }

  async getLawArticle(lawName: string, articleNo: string): Promise<LegalLookupResult> {
    const question = `${lawName} ${articleNo}`;

    return this.run("getLawArticle", ["query", question, "--json"], (stdout) => {
      const envelope = asQueryEnvelope(parseJson(stdout));
      if (!envelope || envelope.isError === true) {
        return cliEmpty("getLawArticle", redactApiKey(stdout));
      }

      const article = parseArticleText(envelope.pipelineResult ?? envelope.result ?? "");
      if (!article?.articleNo) {
        return cliEmpty("getLawArticle", redactApiKey(envelope.result ?? stdout));
      }

      return cliSuccess("getLawArticle", {
        ...article,
        routedTool: envelope.route?.tool,
      });
    });
  }

  async researchAuthorities(question: string): Promise<AuthorityLookupPair> {
    // 자연어 문장을 그대로 CLI에 넘기면 패턴 매칭에 잘 안 걸리므로 핵심 키워드로 정제합니다.
    const keywords = extractSearchKeywords(question);
    const queryTokens = tokenizeKoreanQuery(question);

    const lookup = await this.run("researchQuestion", ["query", keywords, "--json"], (stdout) => {
      const envelope = asQueryEnvelope(parseJson(stdout));
      if (!envelope || envelope.isError === true) {
        return cliEmpty("researchQuestion", redactApiKey(stdout));
      }

      const chain = parseResearchChainText(envelope.result ?? "");
      const article = parseArticleText(envelope.pipelineResult ?? "");

      // 질문이 특정 조문을 지목하면 파이프라인이 그 조문 전문을 함께 돌려줍니다.
      const candidateLawArticles = article?.articleNo && article.lawName
        ? [
            {
              lawName: article.lawName,
              articleNo: article.articleNo,
              title: article.title,
              text: article.text,
              effectiveDate: article.effectiveDate,
            },
            ...chain.lawArticles,
          ]
        : chain.lawArticles;

      // 키워드 정제만으로는 CLI의 "AI 법령검색" 폴백이 반환하는 무관한 결과를 막지 못함을
      // 라이브 검증으로 확인했습니다. 질문과 겹치는 단어가 전혀 없는 결과는 걸러냅니다.
      const lawFilter = filterByRelevance(
        queryTokens,
        candidateLawArticles,
        (a) => `${a.lawName} ${a.title ?? ""} ${a.text ?? ""}`,
      );
      const precedentFilter = filterByRelevance(queryTokens, chain.precedents, (p) => p.title);
      const relevanceFilteredCount = lawFilter.droppedCount + precedentFilter.droppedCount;

      if (lawFilter.kept.length === 0 && precedentFilter.kept.length === 0) {
        return cliEmpty("researchQuestion", redactApiKey(envelope.result ?? stdout));
      }

      return cliSuccess("researchQuestion", {
        question,
        routedTool: envelope.route?.tool,
        lawArticles: lawFilter.kept,
        precedents: precedentFilter.kept,
        failedSections: chain.failedSections,
        relevanceFilteredCount,
      });
    });

    return splitResearchLookup(lookup);
  }

  private async run(
    operation: LegalLookupOperation,
    args: readonly string[],
    parse: (stdout: string) => LegalLookupResult,
  ): Promise<LegalLookupResult> {
    if (!process.env.LAW_OC) {
      return manualFailure("korean-law", operation, new Error("한국 법령 검색 제공자를 사용하려면 LAW_OC 환경변수가 필요합니다."));
    }

    try {
      const { stdout } = await execFileAsync(
        this.command,
        [...args],
        {
          env: {
            ...process.env,
            LAW_OC: process.env.LAW_OC,
          },
          timeout: 15_000,
          maxBuffer: 1024 * 1024,
        },
      );

      const trimmed = stdout.trim();
      if (trimmed.length === 0) {
        return cliEmpty(operation, "");
      }

      return parse(trimmed);
    } catch (error) {
      return manualFailure("korean-law", operation, error);
    }
  }
}

/**
 * 자연어 조회는 CLI를 한 번만 호출하지만, 하위 계층은 법령/판례를 분리된 조회 결과로 다룹니다.
 * 한 번의 결과를 두 슬롯으로 나눠 인용 추출 로직이 그대로 동작하게 합니다.
 */
function splitResearchLookup(lookup: LegalLookupResult): AuthorityLookupPair {
  if (!lookup.ok) {
    return {
      lawSearch: { ...lookup, operation: "searchLaw" },
      precedentSearch: { ...lookup, operation: "searchPrecedents" },
    };
  }

  const data = lookup.data as {
    readonly question?: string;
    readonly lawArticles?: readonly unknown[];
    readonly precedents?: readonly unknown[];
    readonly failedSections?: readonly string[];
    readonly relevanceFilteredCount?: number;
  } | null;

  const lawArticles = data?.lawArticles ?? [];
  const precedents = data?.precedents ?? [];
  const failureNotices = (data?.failedSections ?? []).map(
    (section) => `${section} 조회 실패, 수동 확인 필요`,
  );
  if (data?.relevanceFilteredCount) {
    failureNotices.push("질문과 관련성이 낮은 결과 일부를 제외했습니다.");
  }

  const toResult = (
    operation: LegalLookupOperation,
    results: readonly unknown[],
  ): LegalLookupResult =>
    results.length === 0
      ? {
          ...cliEmpty(operation, ""),
          notices: ["검색 실패", "수동 확인 필요", ...failureNotices],
        }
      : {
          ...cliSuccess(operation, { query: data?.question, results }),
          notices: [CLI_SUCCESS_NOTICE, ...failureNotices],
        };

  return {
    lawSearch: toResult("searchLaw", lawArticles),
    precedentSearch: toResult("searchPrecedents", precedents),
  };
}

function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    return undefined;
  }
}

function createProvider(provider: LegalProvider): LegalSearchProvider {
  return provider === "korean-law" ? new KoreanLawCliProvider() : new MockLegalProvider();
}

export function createMcpLegalService(provider: LegalProvider = getConfiguredProvider()): McpLegalService {
  const searchProvider = createProvider(provider);

  return {
    provider,

    searchLaw(query: string) {
      return searchProvider.searchLaw(query);
    },

    searchPrecedents(query: string) {
      return searchProvider.searchPrecedents(query);
    },

    getLawArticle(lawName: string, articleNo: string) {
      return searchProvider.getLawArticle(lawName, articleNo);
    },

    researchAuthorities(question: string) {
      return searchProvider.researchAuthorities(question);
    },

    async researchLegalAuthorities(request: LegalResearchInput): Promise<LegalAuthoritySearchResult> {
      const query = [request.question, request.facts, request.jurisdiction].filter(Boolean).join(" ");
      const { lawSearch, precedentSearch } = await searchProvider.researchAuthorities(query);

      return mergeAuthorityResults(provider, { lawSearch, precedentSearch });
    },

    async reviewContractAuthorities(request: ContractReviewInput): Promise<LegalAuthoritySearchResult> {
      const query = [request.partyRole, request.concern, request.contractText.slice(0, 500)].filter(Boolean).join(" ");
      const { lawSearch, precedentSearch } = await searchProvider.researchAuthorities(query);

      return mergeAuthorityResults(provider, { lawSearch, precedentSearch });
    },

    async draftDocumentAuthorities(request: DocumentDraftInput): Promise<LegalAuthoritySearchResult> {
      const query = [request.documentType, request.facts, request.requestedOutcome].filter(Boolean).join(" ");
      const { lawSearch } = await searchProvider.researchAuthorities(query);

      return mergeAuthorityResults(provider, { lawSearch });
    },
  };
}

export const mcpLegalService = createMcpLegalService();
