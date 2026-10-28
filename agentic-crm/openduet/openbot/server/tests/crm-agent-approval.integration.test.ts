import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { withApprovalContext } from "@openbot/toolkit/continuation";
import { HeadlessToolSuspension } from "@openbot/toolkit/headless-tools";
import { and, eq, inArray } from "drizzle-orm";
import { createApprovalService } from "../src/approvals/service";
import { createApprovalStore } from "../src/approvals/store";
import type { ApprovalAction } from "../src/approvals/types";
import { createAuditStore } from "../src/audit";
import type { ActionPolicy } from "../src/computer/policy";
import { createCredentialStore } from "../src/credentials";
import { useCrmTools } from "../src/crm/agent-tools";
import { CRM_SERVER, CRM_WRITE_RULE } from "../src/crm/install";
import { contacts, sales } from "../src/crm/schema";
import { createDatabase } from "../src/db/client";
import {
  agents,
  approvalRequests,
  approvalTeamRules,
  mcpServers,
  mcpTools,
  pluginGrants,
  users,
  workItems,
} from "../src/db/schema";
import { createPluginStore } from "../src/plugins/store";
import { createPrivateShareCheck } from "../src/proactive/private-share";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

/**
 * The CRM's promise to the person, end to end: a Bot's CRM write waits for them, and a read does not.
 * Real plugin store, approval store and service, and CRM tools, on a real database. The auto-review
 * model would let everything through, so any asking is the CRM's own rule.
 */

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const suite = randomUUID().slice(0, 8);
const owner = `user_crm_owner_${suite}`;
const botId = `agent_crm_${suite}`;
const TOOLS = ["create_record", "search"];
const policy: ActionPolicy = { mode: "enforce", deny: [], allow: ["true"] };

const approvals = createApprovalStore(database);
const service = createApprovalService(approvals, undefined, undefined, {
  review: async () =>
    JSON.stringify({
      verdict: "proceed",
      preApproved: true,
      safety: "none",
      reason: "Test reviewer.",
    }),
});
const store = createPluginStore({
  brokerProvider: "composio",
  database,
  auditStore: createAuditStore(database),
  credentials: createCredentialStore(database),
  encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  policy: () => policy,
  approvalGate: (candidate) => service.gate(candidate),
  privateShareCheck: createPrivateShareCheck({ approvals }),
});

let serverWasAlreadyThere = false;
let ruleId = "";

const call = (tool: string, args: Record<string, unknown>) =>
  store.callTool({
    ref: `${CRM_SERVER}/${tool}`,
    args,
    botId,
    actorId: owner,
    initiator: { kind: "person" },
  });

function inRun<TResult>(
  threadId: string,
  tool: string,
  args: unknown,
  run: () => Promise<TResult>,
) {
  return withApprovalContext(
    {
      runId: randomUUID(),
      threadId,
      toolCallId: randomUUID(),
      toolName: `${CRM_SERVER}__${tool}`,
      args,
      messages: [{ id: "u1", role: "user", content: "Add Pia to the CRM." }],
      state: {},
      context: [],
      forwardedProps: {},
    },
    run,
  );
}

// What the approval sweep does once the person has answered: run the approved call itself.
async function resume(id: string) {
  const execute = async (action: ApprovalAction) => {
    const result = await store.callTool({
      ref: action.toolRef,
      args: action.args as Record<string, unknown>,
      botId: action.botId,
      actorId: action.actorId,
      initiator: { kind: "person" },
    });
    if (result.isError) throw new Error(result.text);
    return result.text;
  };
  await service.resume(owner, id, {
    validate: (action) =>
      service.validateReentry(action, () => execute(action)),
    execute,
    continue: async () => undefined,
  });
}

const pending = async () =>
  (await approvals.list(owner)).filter(
    (request) => request.status === "pending",
  );

const piaRows = () =>
  database
    .select({ id: contacts.id, sales_id: contacts.sales_id })
    .from(contacts)
    .where(eq(contacts.last_name, `Pending${suite}`));

beforeAll(async () => {
  await database.insert(agents).values({
    id: botId,
    name: botId,
    type: "remote_ag_ui",
    configuration: {},
  });
  await database.insert(users).values({
    id: owner,
    email: `${owner}@crm.test`,
    name: "Maya Okafor",
    emailVerified: false,
  });
  const [existing] = await database
    .select({ id: mcpServers.id })
    .from(mcpServers)
    .where(eq(mcpServers.id, CRM_SERVER));
  serverWasAlreadyThere = existing !== undefined;
  if (!serverWasAlreadyThere) {
    await store.addServer({ key: CRM_SERVER, by: "test" });
  }
  for (const tool of TOOLS) {
    await store.grant("mcp", `${CRM_SERVER}/${tool}`, botId, "test");
  }
  ruleId = randomUUID();
  await database
    .insert(approvalTeamRules)
    .values({ id: ruleId, ...CRM_WRITE_RULE, botId });
  useCrmTools({ database, roleOf: async () => "user" });
  await database
    .insert(contacts)
    .values({ first_name: "Rhea", last_name: `Reader${suite}` });
});

afterAll(async () => {
  useCrmTools(null);
  const requests = (await approvals.list(owner)).map((request) => request.id);
  if (requests.length) {
    await database
      .delete(workItems)
      .where(
        and(
          eq(workItems.kind, "approval.resume"),
          inArray(workItems.key, requests),
        ),
      );
  }
  await database
    .delete(approvalRequests)
    .where(eq(approvalRequests.ownerUserId, owner));
  await database
    .delete(approvalTeamRules)
    .where(eq(approvalTeamRules.id, ruleId));
  await database.delete(pluginGrants).where(
    and(
      eq(pluginGrants.agentId, botId),
      inArray(
        pluginGrants.ref,
        TOOLS.map((tool) => `${CRM_SERVER}/${tool}`),
      ),
    ),
  );
  if (!serverWasAlreadyThere) {
    await database.delete(mcpTools).where(eq(mcpTools.serverId, CRM_SERVER));
    await database.delete(mcpServers).where(eq(mcpServers.id, CRM_SERVER));
  }
  await database
    .delete(contacts)
    .where(inArray(contacts.last_name, [`Pending${suite}`, `Reader${suite}`]));
  await database.delete(sales).where(eq(sales.user_id, owner));
  await database.delete(users).where(eq(users.id, owner));
  await database.delete(agents).where(eq(agents.id, botId));
  await database.$client.end({ timeout: 5 });
});

describe("a Bot's CRM write", () => {
  const args = {
    resource: "contacts",
    values: { first_name: "Pia", last_name: `Pending${suite}` },
  };

  test("waits for the person, and nothing is written until they allow it", async () => {
    const waiting = await inRun("thread-crm", "create_record", args, () =>
      call("create_record", args),
    ).catch((error: unknown) => error);

    expect(waiting).toBeInstanceOf(HeadlessToolSuspension);
    expect(await piaRows()).toEqual([]);
    const asked = await pending();
    expect(asked.map((request) => request.action.toolRef)).toEqual([
      `${CRM_SERVER}/create_record`,
    ]);

    const [request] = asked;
    if (!request) throw new Error("nothing was waiting");
    await approvals.decide(owner, request.id, "allow_once");
    await resume(request.id);

    const [mine] = await database
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.user_id, owner));
    expect(await piaRows()).toEqual([
      { id: expect.any(Number), sales_id: mine?.id ?? -1 },
    ]);
  });

  test("a read goes through without asking", async () => {
    const searchArgs = { query: `Reader${suite}` };
    const result = await inRun("thread-crm-read", "search", searchArgs, () =>
      call("search", searchArgs),
    );

    expect(result.isError).toBe(false);
    expect(result.text).toContain(`Reader${suite}`);
    expect(await pending()).toEqual([]);
  });
});
