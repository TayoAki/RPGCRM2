import { and, eq } from "drizzle-orm";
import { type AuditStore, recordAuditEvent } from "../audit";
import type { OpenBotRole } from "../auth/roles";
import type { Database } from "../db/client";
import { agents, approvalTeamRules, mcpServers } from "../db/schema";
import type { PluginStore } from "../plugins/store";
import { listTools, useCrmTools } from "./agent-tools";
import type { ProspectingConfig } from "./prospecting/settings";
import {
  OUTREACH_TOOL_NAMES,
  PROSPECTING_TOOL_NAMES,
} from "./prospecting/tools";
import { installs } from "./schema";

export const CRM_SERVER = "crm";
const INSTALL_STEP = "agent-tools";
const INSTALLED_BY = "crm-install";

export const CRM_WRITE_RULE = {
  botId: "*",
  toolRef: `${CRM_SERVER}/*`,
  effect: "write",
  scope: CRM_SERVER,
  behaviour: "ask" as const,
};

/**
 * Makes the CRM's tools ready for Bots, at boot.
 *
 * Once per deployment, it adds the "crm" catalogue entry, grants its tools to every Bot, and adds the
 * team rule that has a Bot ask the person before any CRM write. After that they are an admin's to
 * change at /admin/plugins and in the approval rules, and later boots only refresh the tool list. It
 * is marked done only once it worked, so a boot that failed halfway tries again, and every step is
 * safe to repeat.
 */
export async function installCrmTools(deps: {
  database: Database;
  pluginStore: Pick<PluginStore, "addServer" | "grant" | "refreshTools">;
  audit: AuditStore;
  roleOf: (userId: string) => Promise<OpenBotRole>;
  prospecting?: ProspectingConfig;
}): Promise<void> {
  const { database, pluginStore } = deps;
  useCrmTools({
    database,
    roleOf: deps.roleOf,
    ...(deps.prospecting ? { prospecting: deps.prospecting } : {}),
  });

  const [done] = await database
    .select({ name: installs.name })
    .from(installs)
    .where(eq(installs.name, INSTALL_STEP));
  if (done) {
    const [server] = await database
      .select({ id: mcpServers.id })
      .from(mcpServers)
      .where(eq(mcpServers.id, CRM_SERVER));
    if (server) {
      await pluginStore.refreshTools(CRM_SERVER);
      await grantLaterTools(database, pluginStore);
    }
    return;
  }

  await pluginStore.addServer({ key: CRM_SERVER, by: INSTALLED_BY });
  const [tools, bots] = await Promise.all([
    listTools(),
    database.select({ id: agents.id }).from(agents),
  ]);
  for (const bot of bots) {
    for (const tool of tools) {
      await pluginStore.grant(
        "mcp",
        `${CRM_SERVER}/${tool.name}`,
        bot.id,
        INSTALLED_BY,
      );
    }
  }

  const [standing] = await database
    .select({ id: approvalTeamRules.id })
    .from(approvalTeamRules)
    .where(
      and(
        eq(approvalTeamRules.toolRef, CRM_WRITE_RULE.toolRef),
        eq(approvalTeamRules.effect, CRM_WRITE_RULE.effect),
      ),
    );
  if (!standing) {
    const id = crypto.randomUUID();
    await database.insert(approvalTeamRules).values({ id, ...CRM_WRITE_RULE });
    await recordAuditEvent(deps.audit, {
      eventType: "approval.rule_changed",
      targetType: "approval_rule",
      targetId: id,
      payload: {
        change: "created",
        layer: "team",
        rule: CRM_WRITE_RULE,
        by: INSTALLED_BY,
      },
    });
  }

  await database
    .insert(installs)
    .values([
      { name: INSTALL_STEP },
      ...LATER_TOOLS.map(({ step }) => ({ name: step })),
    ])
    .onConflictDoNothing();
}

// Tools added after a deployment first installed the CRM's: granted to every Bot once, as those were.
const LATER_TOOLS = [
  {
    step: "agent-tools-reports",
    tools: ["run_report", "list_reports", "make_chart"],
  },
  { step: "agent-tools-prospecting", tools: PROSPECTING_TOOL_NAMES },
  { step: "agent-tools-outreach", tools: OUTREACH_TOOL_NAMES },
];

async function grantLaterTools(
  database: Database,
  pluginStore: Pick<PluginStore, "grant">,
) {
  const done = new Set(
    (await database.select({ name: installs.name }).from(installs)).map(
      (row) => row.name,
    ),
  );
  for (const { step, tools } of LATER_TOOLS) {
    if (done.has(step)) continue;
    const bots = await database.select({ id: agents.id }).from(agents);
    for (const bot of bots) {
      for (const tool of tools) {
        await pluginStore.grant(
          "mcp",
          `${CRM_SERVER}/${tool}`,
          bot.id,
          INSTALLED_BY,
        );
      }
    }
    await database
      .insert(installs)
      .values({ name: step })
      .onConflictDoNothing();
  }
}
