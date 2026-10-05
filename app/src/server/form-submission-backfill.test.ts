// @vitest-environment node
import { describe, expect, it } from "vitest";
import { planBackfill } from "./form-submission-backfill";
import { LOCK_PATH, PACKAGE_PATH } from "./release-version";

const ROASTERS = "app/src/data/coffee-roasters.json";
const MULTI = "app/src/data/coffee-roasters-multi.json";
const existing = { Name: "Existing Coffee", Website: "https://existing.coffee/", State: "VIC", hasCafe: true, multiRoaster: false };
function files() {
  return {
    [ROASTERS]: JSON.stringify([existing], null, 2), [MULTI]: "[]\n",
    [PACKAGE_PATH]: JSON.stringify({ name: "test-site", version: "1.1.9" }),
    [LOCK_PATH]: JSON.stringify({ name: "test-site", version: "1.1.9", packages: { "": { name: "test-site", version: "1.1.9" }, "node_modules/example": { version: "2.0.0" } } }),
  };
}
function payload(id = "old-123", extra: Record<string, unknown> = {}) {
  return { id, form_name: "roaster-form", data: { recommendation: "on", issue: "", "roaster-name": "New Coffee", "roaster-website": "https://new.coffee/", state: "VIC", email: "private@example.com", ip: "127.0.0.1", details: "Private old free text", ...extra } };
}
const review = { fields: { "has-cafe": "true", "multi-roaster": "false" }, sources: ["https://new.coffee/about"] };

describe("historical form backfill", () => {
  it("requires review of missing classifications without defaulting them", () => {
    const plan = planBackfill([payload()], {}, files());
    expect(plan.results[0].status).toBe("needs-review");
    expect(plan.contents).toEqual({});
    expect(plan.release).toBeUndefined();
  });
  it("recognizes existing recommendations even without the new flags", () => {
    const plan = planBackfill([payload("old-123", { "roaster-name": "Existing Coffee", "roaster-website": "http://www.existing.coffee" })], {}, files());
    expect(plan.results[0].status).toBe("duplicate");
    expect(plan.contents).toEqual({});
  });
  it("batches reviewed additions, skips repeated proposals, bumps once, and omits private data", () => {
    const inputs = [payload(), payload("old-456"), payload("old-789", { "roaster-name": "Other Coffee", "roaster-website": "https://other.coffee" })];
    const plan = planBackfill(inputs, { "old-123": review, "old-789": review }, files());
    expect(plan.results.map(row => row.status)).toEqual(["proposed", "duplicate-backlog", "proposed"]);
    expect(JSON.parse(plan.contents[ROASTERS])).toHaveLength(3);
    expect(plan.release).toEqual({ previousVersion: "1.1.9", version: "1.1.10" });
    expect(JSON.parse(plan.contents[LOCK_PATH]).packages["node_modules/example"].version).toBe("2.0.0");
    const output = JSON.stringify(plan);
    for (const secret of ["private@example.com", "127.0.0.1", "Private old free text"]) expect(output).not.toContain(secret);
    expect(JSON.parse(plan.contents[".github/form-submissions/old-123.json"]).sources).toEqual(review.sources);
  });
  it("preserves unspecified correction flags and fixes a website", () => {
    const input = payload("old-123", { recommendation: "", issue: "on", "roaster-name": "Existing Coffee", "roaster-website": "https://correct.coffee" });
    const plan = planBackfill([input], {}, files());
    expect(JSON.parse(plan.contents[ROASTERS])).toEqual([{ ...existing, Website: "https://correct.coffee/" }]);
  });
  it("groups repeated incomplete recommendations into one review task", () => {
    const plan = planBackfill([payload(), payload("old-456")], {}, files());
    expect(plan.results.map(row => row.status)).toEqual(["needs-review", "duplicate-backlog"]);
    expect(plan.results[1].reason).toContain("old-123");
    expect(plan.contents).toEqual({});
  });
  it("requires an explicit type when old checkboxes are ambiguous", () => {
    const input = payload("old-123", { recommendation: "", issue: "" });
    expect(planBackfill([input], {}, files()).results[0].status).toBe("needs-review");
    expect(planBackfill([input], { "old-123": { fields: { ...review.fields, "submission-type": "recommendation" } } }, files()).results[0].status).toBe("proposed");
  });
  it("is idempotent after changes have been written, including corrections", () => {
    const inputs = [payload(), payload("old-456", { recommendation: "", issue: "on", "roaster-name": "Existing Coffee", "roaster-website": "https://correct.coffee" })];
    const reviews = { "old-123": review };
    const original = files();
    const first = planBackfill(inputs, reviews, original);
    const second = planBackfill(inputs, reviews, { ...original, ...first.contents });
    expect(second.results.map(row => row.status)).toEqual(["processed", "processed"]);
    expect(second.contents).toEqual({});
  });
  it("ignores honeypots and other forms, validates IDs, and respects review exclusions", () => {
    const plan = planBackfill([payload("spam", { "bot-field": "spam" }), { ...payload("other"), form_name: "contact" }, payload("test")], { test: { action: "skip", reason: "Test submission" } }, files());
    expect(plan.results.map(row => row.status)).toEqual(["ignored", "ignored", "skipped"]);
    expect(() => planBackfill([payload("../main")], {}, files())).toThrow("Invalid submission ID");
    expect(planBackfill([payload()], { "old-123": { fields: { email: "private@example.com" } } }, files()).results[0].status).toBe("needs-review");
  });
});
