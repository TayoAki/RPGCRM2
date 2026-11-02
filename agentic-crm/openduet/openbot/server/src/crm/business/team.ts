import type { AuthenticatedActor } from "../../auth/guards";
import type { Database } from "../../db/client";
import { type TeamMember, updateMember } from "./plan";

/*
 * The plan's specialist Bots, made real when a job of theirs is first turned on. Each gets only the
 * tools its plan lists that the main Bot also holds, and a team rule that it asks before any change.
 * What an admin lets it do without asking is a team rule for that Bot and that tool, which the
 * approval gate lets settle the broader asks (approvals/policy.ts, strictestRule).
 */

const BY = "work-plan";

type TeamRule = {
  id: string;
  botId: string;
  toolRef: string;
  effect: string;
  scope: string;
  behaviour: string;
};

export type TeamDeps = {
  database: Database;
  primaryBotId: string;
  bots: {
    create(
      actor: AuthenticatedActor,
      input: {
        name: string;
        title: string;
        roleDescription: string;
        visibility: "public" | "private";
        systemPrompt: string;
      },
    ): Promise<{ id: string }>;
    exists(actor: AuthenticatedActor, botId: string): Promise<boolean>;
  };
  heldTools: (botId: string) => Promise<string[]>;
  grant: (ref: string, botId: string, by: string) => Promise<void>;
  rules: {
    teamRules(): Promise<TeamRule[]>;
    createTeamRule(
      by: string,
      input: Omit<TeamRule, "id" | "behaviour"> & {
        behaviour: "allow" | "ask";
      },
    ): Promise<unknown>;
    revokeTeamRule(by: string, id: string): Promise<unknown>;
  };
};

export const promptFor = (
  member: Pick<TeamMember, "name" | "title" | "role">,
) =>
  [
    `You are ${member.name}, ${member.title}, one of this company's team of Bots.`,
    member.role,
    "Stick to your own jobs. When a request belongs to someone else, say which teammate or person should take it.",
  ].join("\n\n");

/** The member's Bot, created and equipped the first time it is needed. */
export async function ensureBot(
  deps: TeamDeps,
  actor: AuthenticatedActor,
  member: TeamMember,
): Promise<{ botId: string; created: boolean; dropped: string[] }> {
  if (member.botId && (await deps.bots.exists(actor, member.botId))) {
    return { botId: member.botId, created: false, dropped: [] };
  }
  const held = new Set(await deps.heldTools(deps.primaryBotId));
  const tools = member.tools.filter((ref) => held.has(ref));
  const bot = await deps.bots.create(actor, {
    name: member.name,
    title: member.title,
    roleDescription: member.role,
    visibility: "public",
    systemPrompt: promptFor(member),
  });
  for (const ref of tools) await deps.grant(ref, bot.id, BY);
  await deps.rules.createTeamRule(actor.id, {
    botId: bot.id,
    toolRef: "*",
    effect: "write",
    scope: "*",
    behaviour: "ask",
  });
  await updateMember(deps.database, member.key, { botId: bot.id });
  return {
    botId: bot.id,
    created: true,
    dropped: member.tools.filter((ref) => !held.has(ref)),
  };
}

/** Makes the team rules say exactly that this Bot may use `allowed` without asking. */
export async function syncAllowed(
  deps: TeamDeps,
  actor: AuthenticatedActor,
  member: TeamMember,
  botId: string,
  allowed: string[],
) {
  const want = new Set(allowed.filter((ref) => member.tools.includes(ref)));
  const existing = (await deps.rules.teamRules()).filter(
    (rule) =>
      rule.botId === botId &&
      rule.behaviour === "allow" &&
      rule.effect === "write" &&
      member.tools.includes(rule.toolRef),
  );
  for (const rule of existing) {
    if (!want.has(rule.toolRef))
      await deps.rules.revokeTeamRule(actor.id, rule.id);
  }
  const have = new Set(existing.map((rule) => rule.toolRef));
  for (const ref of want) {
    if (have.has(ref)) continue;
    await deps.rules.createTeamRule(actor.id, {
      botId,
      toolRef: ref,
      effect: "write",
      scope: "*",
      behaviour: "allow",
    });
  }
  await updateMember(deps.database, member.key, { allowed: [...want] });
  return [...want];
}

/** "crm/track_bid" reads "Track bid"; "gmail/GMAIL_ADD_LABEL" reads "Gmail add label". */
export const actionLabel = (ref: string) => {
  const name = (ref.split("/")[1] ?? ref)
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The team's dependencies from the stores the server already has. */
export function createWorkPlanTeam(stores: {
  profiles: {
    create(
      actor: AuthenticatedActor,
      input: TeamDepsCreateInput,
    ): Promise<{ id: string }>;
    get(
      actor: AuthenticatedActor,
      id: string,
    ): Promise<unknown | null | undefined>;
  };
  plugins: {
    grant(kind: "mcp", ref: string, agentId: string, by: string): Promise<void>;
    listForAgent(agentId: string): Promise<{ tools: { ref: string }[] }>;
  };
  // Absent on a deployment without approvals: jobs then run on the main Bot.
  rules?: TeamDeps["rules"] | undefined;
}): Partial<Omit<TeamDeps, "database" | "primaryBotId">> {
  return {
    bots: {
      create: (actor, input) => stores.profiles.create(actor, input),
      exists: async (actor, botId) =>
        !!(await stores.profiles.get(actor, botId)),
    },
    heldTools: async (botId) =>
      (await stores.plugins.listForAgent(botId)).tools.map((tool) => tool.ref),
    grant: (ref, botId, by) => stores.plugins.grant("mcp", ref, botId, by),
    ...(stores.rules ? { rules: stores.rules } : {}),
  };
}

type TeamDepsCreateInput = Parameters<TeamDeps["bots"]["create"]>[1];
