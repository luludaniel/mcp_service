import { createServer, type Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "./app.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected server to listen on a TCP address");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

describe("legal MCP harness API", () => {
  it("returns health status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as { ok: boolean; service: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("general-legal-service-mcp-harness");
  });

  it("returns the harness definition", async () => {
    const response = await fetch(`${baseUrl}/api/harness`);
    const body = (await response.json()) as { serviceScope: string[]; audiences: string[] };

    expect(response.status).toBe(200);
    expect(body.serviceScope).toEqual(["legal_research", "contract_review", "document_drafting"]);
    expect(body.audiences).toEqual(["general_user", "business", "professional"]);
  });

  it("returns a single workflow", async () => {
    const response = await fetch(`${baseUrl}/api/workflows/contract_review`);
    const body = (await response.json()) as { id: string; steps: unknown[] };

    expect(response.status).toBe(200);
    expect(body.id).toBe("contract_review");
    expect(body.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("blocks education and classroom contexts", async () => {
    const response = await fetch(`${baseUrl}/api/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "수업 과제로 계약법 자료를 정리해 주세요." }),
    });
    const body = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(422);
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe("excluded_context");
  });

  it("routes contract prompts to contract review", async () => {
    const response = await fetch(`${baseUrl}/api/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "공급계약의 책임제한 조항을 검토해 주세요." }),
    });
    const body = (await response.json()) as { allowed: boolean; capability: string };

    expect(response.status).toBe(200);
    expect(body.allowed).toBe(true);
    expect(body.capability).toBe("contract_review");
  });

  it("runs legal research workflow with policy fields", async () => {
    const response = await fetch(`${baseUrl}/api/legal-research`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "미지급 프리랜서 용역대금에 대해 어떤 조치를 검토할 수 있나요?" }),
    });
    const body = (await response.json()) as {
      allowed: boolean;
      workflow: string;
      mockResult: { issue: string; likelySources: string[] };
      authoritySearch: { provider: string; manualReviewRequired: boolean };
      citationVerification: { limitations: string[]; blocksDefinitiveAnalysis: boolean };
      policy: { informationalOnly: boolean; requiresExpertReview: boolean; prohibitsGuaranteedOutcome: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.allowed).toBe(true);
    expect(body.workflow).toBe("legal_research");
    expect(body.mockResult.issue).toContain("프리랜서 용역대금");
    expect(body.mockResult.likelySources.length).toBeGreaterThan(0);
    expect(body.authoritySearch.provider).toBe("mock");
    expect(body.authoritySearch.manualReviewRequired).toBe(true);
    expect(body.citationVerification.limitations).toContain("출처 확인 필요");
    expect(body.citationVerification.blocksDefinitiveAnalysis).toBe(true);
    expect(body.policy.informationalOnly).toBe(true);
    expect(body.policy.requiresExpertReview).toBe(true);
    expect(body.policy.prohibitsGuaranteedOutcome).toBe(true);
  });

  it("validates contract review input with zod", async () => {
    const response = await fetch(`${baseUrl}/api/contract-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractText: "당사자 지위 없이 계약서 본문만 입력" }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_request");
  });

  it("runs contract review workflow", async () => {
    const response = await fetch(`${baseUrl}/api/contract-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractText: "공급자는 언제든 계약을 해지할 수 있고 고객은 남은 대금을 모두 부담합니다.",
        partyRole: "고객",
      }),
    });
    const body = (await response.json()) as {
      allowed: boolean;
      workflow: string;
      mockResult: { riskLevel: string; detectedIssues: string[] };
      citationVerification: { limitations: string[] };
      policy: { requiresExpertReview: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.allowed).toBe(true);
    expect(body.workflow).toBe("contract_review");
    expect(body.mockResult.riskLevel).toBe("high");
    expect(body.mockResult.detectedIssues.length).toBeGreaterThan(0);
    expect(body.mockResult.detectedIssues[0]).toContain("위험");
    expect(body.citationVerification.limitations).toContain("출처 확인 필요");
    expect(body.policy.requiresExpertReview).toBe(true);
  });

  it("runs document draft workflow as draft only", async () => {
    const response = await fetch(`${baseUrl}/api/document-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentType: "지급 요청서",
        facts: "거래처가 두 차례 독촉 후에도 청구서 2026-001 금액을 지급하지 않았습니다.",
        recipient: "거래처",
      }),
    });
    const body = (await response.json()) as {
      allowed: boolean;
      workflow: string;
      mockResult: { sections: string[]; placeholders: string[] };
      safetyReview: { expertReviewRequired: boolean };
      citationVerification: { sourceSufficiency: string };
      policy: { draftOnly: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.allowed).toBe(true);
    expect(body.workflow).toBe("document_drafting");
    expect(body.mockResult.sections).toContain("요청 사항");
    expect(body.mockResult.placeholders.length).toBeGreaterThan(0);
    expect(body.safetyReview.expertReviewRequired).toBe(false);
    expect(body.citationVerification.sourceSufficiency).toBe("partial");
    expect(body.policy.draftOnly).toBe(true);
  });

  it("returns the litigation prep catalog", async () => {
    const response = await fetch(`${baseUrl}/api/litigation-prep/catalog`);
    const body = (await response.json()) as { catalog: Record<string, string> };

    expect(response.status).toBe(200);
    expect(Object.keys(body.catalog)).toEqual(["민사", "형사", "가정법원"]);
    expect(body.catalog["민사"]).toContain("대금/용역비 미지급");
  });

  it("validates litigation prep input with zod", async () => {
    const response = await fetch(`${baseUrl}/api/litigation-prep`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_request");
  });

  it("classifies a matched case type and returns a checklist", async () => {
    const response = await fetch(`${baseUrl}/api/litigation-prep`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ situation: "프리랜서로 일했는데 용역대금을 못 받았어요." }),
    });
    const body = (await response.json()) as {
      allowed: boolean;
      classificationScope: Record<string, string>;
      mockResult: { requiredEvidence: string[]; requiredDocuments: string[] };
      browseCatalog?: Record<string, string>;
      policy: { requiresExpertReview: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.allowed).toBe(true);
    expect(body.classificationScope["분야"]).toBe("민사");
    expect(body.classificationScope["사건 유형"]).toBe("대금/용역비 미지급");
    expect(body.mockResult.requiredEvidence.length).toBeGreaterThan(0);
    expect(body.mockResult.requiredDocuments.length).toBeGreaterThan(0);
    expect(body.browseCatalog).toBeUndefined();
    expect(body.policy.requiresExpertReview).toBe(true);
  });

  it("returns the full catalog to browse when the situation is unclear", async () => {
    const response = await fetch(`${baseUrl}/api/litigation-prep`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ situation: "오늘 날씨가 좋네요." }),
    });
    const body = (await response.json()) as {
      allowed: boolean;
      classificationScope: Record<string, string>;
      mockResult?: unknown;
      browseCatalog: Record<string, string>;
    };

    expect(response.status).toBe(200);
    expect(body.allowed).toBe(true);
    expect(body.classificationScope["분야"]).toBe("판단 어려움");
    expect(body.mockResult).toBeUndefined();
    expect(Object.keys(body.browseCatalog)).toEqual(["민사", "형사", "가정법원"]);
  });

  it("blocks education context in litigation prep too", async () => {
    const response = await fetch(`${baseUrl}/api/litigation-prep`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ situation: "수업 과제로 형사소송법 판례를 조사해줘." }),
    });
    const body = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(422);
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe("excluded_education_context");
  });

  it("blocks Korean education context in new workflow endpoints", async () => {
    const response = await fetch(`${baseUrl}/api/legal-research`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "수업 과제로 계약법 판례를 조사해줘." }),
    });
    const body = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(422);
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe("excluded_education_context");
  });
});
