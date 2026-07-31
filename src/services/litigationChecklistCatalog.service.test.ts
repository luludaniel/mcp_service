import { describe, expect, it } from "vitest";

import {
  buildCatalogIndex,
  DOMAIN_LABELS,
  getChecklistById,
  getChecklistsByDomain,
  LITIGATION_CHECKLISTS,
} from "./litigationChecklistCatalog.service.js";

describe("litigationChecklistCatalog", () => {
  it("gives every checklist template non-empty content in every section", () => {
    for (const template of LITIGATION_CHECKLISTS) {
      expect(template.requiredEvidence.length).toBeGreaterThan(0);
      expect(template.requiredDocuments.length).toBeGreaterThan(0);
      expect(template.deadlinesAndLimitations.length).toBeGreaterThan(0);
      expect(template.jurisdictionNotes.length).toBeGreaterThan(0);
      expect(template.preLitigationSteps.length).toBeGreaterThan(0);
      expect(template.keywords.length).toBeGreaterThan(0);
    }
  });

  it("covers all three domains with at least one checklist each", () => {
    const domains = new Set(LITIGATION_CHECKLISTS.map((template) => template.domain));

    expect(domains).toEqual(new Set(["civil", "criminal", "family"]));
  });

  it("looks up a checklist by id", () => {
    expect(getChecklistById("civil-unpaid-fee")?.label).toBe("대금/용역비 미지급");
    expect(getChecklistById("does-not-exist")).toBeUndefined();
  });

  it("filters checklists by domain", () => {
    const familyChecklists = getChecklistsByDomain("family");

    expect(familyChecklists.every((template) => template.domain === "family")).toBe(true);
    expect(familyChecklists.length).toBeGreaterThan(0);
  });

  it("builds a catalog index keyed by Korean domain labels", () => {
    const index = buildCatalogIndex();

    expect(Object.keys(index)).toEqual([DOMAIN_LABELS.civil, DOMAIN_LABELS.criminal, DOMAIN_LABELS.family]);
    expect(index[DOMAIN_LABELS.civil]).toContain("대금/용역비 미지급");
  });
});
