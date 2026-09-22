import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api";
import { connectionIssue } from "../src/connection-issue";

describe("connection issues", () => {
  it("tells an unapproved site how to get approved", () => {
    const issue = connectionIssue(
      new ApiError(403, "not approved", "site_not_approved"),
      "preview.example.com"
    );
    expect(issue.kind).toBe("site");
    expect(issue.title).toBe("This site isn’t approved");
    expect(issue.detail).toContain("preview.example.com");
    expect(issue.detail).toContain("Account → Approved sites");
  });
  it("separates offline from an unreachable server", () => {
    expect(connectionIssue(new ApiError(0, "", "offline")).kind).toBe(
      "offline"
    );
    const unreachable = connectionIssue(
      new ApiError(0, "", "unreachable"),
      "site.example"
    );
    expect(unreachable.title).toBe("Can’t reach komo");
    expect(unreachable.detail).toContain("site.example");
  });
  it("passes server messages through", () => {
    const issue = connectionIssue(new ApiError(500, "Comments are down."));
    expect(issue).toMatchObject({
      kind: "server",
      detail: "Comments are down.",
    });
  });
});
