import { expect, test } from "bun:test";
import { strictestRule } from "../src/approvals/policy";
import type {
  ApprovalCandidate,
  ApprovalRule,
  ApprovalTeamRule,
} from "../src/approvals/types";

const candidate = (botId: string, toolRef: string) =>
  ({
    actorId: "person",
    botId,
    toolRef,
    effect: "write",
    scope: "crm",
  }) as ApprovalCandidate;

const team = (
  id: string,
  botId: string,
  toolRef: string,
  behaviour: ApprovalTeamRule["behaviour"],
): ApprovalTeamRule =>
  ({
    id,
    botId,
    toolRef,
    effect: "write",
    scope: "*",
    behaviour,
    createdBy: null,
  }) as ApprovalTeamRule;

const RULES = [
  team("crm-asks", "*", "crm/*", "ask"),
  team("front-desk-asks", "front-desk", "*", "ask"),
  team("front-desk-may-log", "front-desk", "crm/create_record", "allow"),
];

test("a team rule naming this Bot and tool wins over the team's broader asks", () => {
  expect(
    strictestRule(candidate("front-desk", "crm/create_record"), RULES, [])?.rule
      .id,
  ).toBe("front-desk-may-log");
});

test("everything else that Bot does still asks, and other Bots are untouched", () => {
  expect(
    strictestRule(candidate("front-desk", "crm/update_record"), RULES, [])?.rule
      .behaviour,
  ).toBe("ask");
  expect(
    strictestRule(candidate("sales", "crm/create_record"), RULES, [])?.rule.id,
  ).toBe("crm-asks");
});

test("a person's own stricter rule still beats the team's specific allow", () => {
  const personal = [
    {
      ...team("mine", "*", "crm/*", "ask"),
      ownerUserId: "person",
    } as ApprovalRule,
  ];
  expect(
    strictestRule(
      candidate("front-desk", "crm/create_record"),
      RULES,
      personal,
    ),
  ).toMatchObject({
    layer: "personal_rule",
    rule: { id: "mine" },
  });
});

test("among several specific team rules, the strictest still wins", () => {
  const both = [
    ...RULES,
    team("front-desk-hands-off", "front-desk", "crm/create_record", "hand_off"),
  ];
  expect(
    strictestRule(candidate("front-desk", "crm/create_record"), both, [])?.rule
      .behaviour,
  ).toBe("hand_off");
});
