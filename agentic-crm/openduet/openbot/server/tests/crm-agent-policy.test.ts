import { describe, expect, test } from "bun:test";
import { decideAction } from "../src/approvals/policy";
import type {
  ApprovalCandidate,
  ApprovalRule,
  ApprovalTeamRule,
} from "../src/approvals/types";
import { CRM_WRITE_RULE } from "../src/crm/install";

const seeded: ApprovalTeamRule = {
  ...CRM_WRITE_RULE,
  id: "crm-writes",
  createdBy: null,
  revokedAt: null,
  createdAt: new Date(),
};

const decide = (
  over: Partial<ApprovalCandidate>,
  personal: ApprovalRule[] = [],
) =>
  decideAction({
    candidate: {
      actorId: "maya",
      botId: "openduet",
      toolRef: "crm/create_record",
      effect: "write",
      scope: "crm",
      args: {},
      ...over,
    },
    team: [seeded],
    personal,
    customRulesEnabled: true,
    autoReview: false,
    askBeforeChanges: false,
  });

describe("the CRM's approval rule", () => {
  test("asks the person before a CRM write, even one about billing", async () => {
    const outcome = await decide({
      args: {
        resource: "deals",
        values: { name: "Billing upgrade", description: "New payment terms" },
      },
    });

    expect(outcome.behaviour).toBe("ask");
  });

  test("still asks when the person once said always allow", async () => {
    const outcome = await decide({}, [
      {
        id: "mine",
        ownerUserId: "maya",
        botId: "*",
        toolRef: "crm/*",
        effect: "*",
        scope: "*",
        behaviour: "allow",
        revokedAt: null,
        createdAt: new Date(),
      },
    ]);

    expect(outcome.behaviour).toBe("ask");
  });

  test("lets reads through without asking", async () => {
    const outcome = await decide({ toolRef: "crm/search", effect: "read" });

    expect(outcome.behaviour).not.toBe("ask");
    expect(outcome.behaviour).not.toBe("hand_off");
  });
});
