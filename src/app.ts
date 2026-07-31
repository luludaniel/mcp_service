import cors from "cors";
import express, { type Request, type Response } from "express";
import { z } from "zod";

import { buildCatalogIndex } from "./services/litigationChecklistCatalog.service.js";
import { LEGAL_SERVICE_HARNESS, getWorkflow, isExcludedContext } from "./harness.js";
import type { CapabilityId } from "./types.js";
import {
  contractReviewWorkflow,
  documentDraftWorkflow,
  legalResearchWorkflow,
  litigationPrepWorkflow,
} from "./workflows/index.js";

const capabilitySchema = z.enum(["legal_research", "contract_review", "document_drafting"]);

const evaluateRequestSchema = z.object({
  prompt: z.string().min(1),
  capability: capabilitySchema.optional(),
});

const legalResearchRequestSchema = z.object({
  question: z.string().min(1),
  facts: z.string().min(1).optional(),
  jurisdiction: z.string().min(1).optional(),
});

const contractReviewRequestSchema = z.object({
  contractText: z.string().min(1),
  partyRole: z.string().min(1),
  concern: z.string().min(1).optional(),
});

const documentDraftRequestSchema = z.object({
  documentType: z.string().min(1),
  facts: z.string().min(1),
  recipient: z.string().min(1).optional(),
  requestedOutcome: z.string().min(1).optional(),
});

const litigationPrepRequestSchema = z.object({
  situation: z.string().min(1),
  domain: z.enum(["criminal", "civil", "family"]).optional(),
});

function inferCapability(prompt: string): CapabilityId {
  const normalized = prompt.toLowerCase();

  if (
    normalized.includes("contract") ||
    normalized.includes("agreement") ||
    normalized.includes("clause") ||
    normalized.includes("계약") ||
    normalized.includes("조항")
  ) {
    return "contract_review";
  }

  if (
    normalized.includes("draft") ||
    normalized.includes("letter") ||
    normalized.includes("resolution") ||
    normalized.includes("초안") ||
    normalized.includes("문서") ||
    normalized.includes("내용증명") ||
    normalized.includes("의사록")
  ) {
    return "document_drafting";
  }

  return "legal_research";
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request: Request, response: Response) => {
    response.json({
      ok: true,
      service: LEGAL_SERVICE_HARNESS.name,
      version: LEGAL_SERVICE_HARNESS.version,
    });
  });

  app.get("/api/harness", (_request: Request, response: Response) => {
    response.json(LEGAL_SERVICE_HARNESS);
  });

  app.get("/api/workflows", (_request: Request, response: Response) => {
    response.json({
      workflows: LEGAL_SERVICE_HARNESS.workflows,
    });
  });

  app.get("/api/workflows/:id", (request: Request, response: Response) => {
    const parsed = capabilitySchema.safeParse(request.params.id);
    if (!parsed.success) {
      response.status(404).json({
        error: "unknown_workflow",
        allowed: LEGAL_SERVICE_HARNESS.serviceScope,
      });
      return;
    }

    const workflow = getWorkflow(parsed.data);
    if (!workflow) {
      response.status(404).json({
        error: "unknown_workflow",
        allowed: LEGAL_SERVICE_HARNESS.serviceScope,
      });
      return;
    }

    response.json(workflow);
  });

  app.post("/api/evaluate", (request: Request, response: Response) => {
    const parsed = evaluateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
      return;
    }

    if (isExcludedContext(parsed.data.prompt)) {
      response.status(422).json({
        allowed: false,
        reason: "excluded_context",
        excludedContexts: LEGAL_SERVICE_HARNESS.policy.excludedContexts,
      });
      return;
    }

    const capability = parsed.data.capability ?? inferCapability(parsed.data.prompt);
    const workflow = getWorkflow(capability);

    response.json({
      allowed: true,
      capability,
      workflow,
      disclaimers: LEGAL_SERVICE_HARNESS.policy.requiredDisclaimers,
      escalationRules: LEGAL_SERVICE_HARNESS.policy.escalationRules,
    });
  });

  app.post("/api/legal-research", async (request: Request, response: Response) => {
    const parsed = legalResearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await legalResearchWorkflow(parsed.data);
    response.status(result.allowed ? 200 : 422).json(result);
  });

  app.post("/api/contract-review", async (request: Request, response: Response) => {
    const parsed = contractReviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await contractReviewWorkflow(parsed.data);
    response.status(result.allowed ? 200 : 422).json(result);
  });

  app.post("/api/document-draft", async (request: Request, response: Response) => {
    const parsed = documentDraftRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await documentDraftWorkflow(parsed.data);
    response.status(result.allowed ? 200 : 422).json(result);
  });

  app.get("/api/litigation-prep/catalog", (_request: Request, response: Response) => {
    response.json({ catalog: buildCatalogIndex() });
  });

  app.post("/api/litigation-prep", async (request: Request, response: Response) => {
    const parsed = litigationPrepRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await litigationPrepWorkflow(parsed.data);
    response.status(result.allowed ? 200 : 422).json(result);
  });

  return app;
}
