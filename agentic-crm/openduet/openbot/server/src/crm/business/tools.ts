import type { AuthenticatedActor } from "../../auth/guards";
import type { Database } from "../../db/client";
import type { McpTool } from "../../plugins/mcp";
import type { CrmRecords } from "../records";
import { MAX_BRIEF_CHARS, readBrief, saveBrief } from "./brief";
import {
  checkPlan,
  itemSummary,
  MAX_BOT_TOOLS,
  readPlan,
  savePlan,
} from "./plan";

type Outcome = { ok: true; value: unknown } | { ok: false; message: string };

export type BusinessToolContext = {
  /** The tool refs the calling Bot holds: all a team Bot may be given. */
  heldTools?: () => Promise<string[]>;
  /** The CRM's write tools, marked so the plan can offer them as "without asking". */
  crmWriteTools: readonly string[];
};

const MAX_TOOLS_PER_APP = 40;

export const BUSINESS_TOOLS: readonly McpTool[] = Object.freeze([
  {
    name: "business_brief",
    description:
      "The company brief every Bot works from, the current work plan and team, the tools you can give team Bots (by app, with the CRM's write tools marked), and how big the CRM is. Read it before writing or changing either.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "save_business_brief",
    description: `Save the company brief. Every Bot reads it on every run, so keep it to facts the person gave or confirmed, under ${MAX_BRIEF_CHARS} characters, in these sections: What we do; Who we sell to; How we win work; Goals right now; How we talk; Never. Replaces the old brief. The person approves first.`,
    inputSchema: {
      type: "object",
      properties: { brief: { type: "string", maxLength: MAX_BRIEF_CHARS } },
      required: ["brief"],
    },
  },
  {
    name: "save_work_plan",
    description: `Save the work plan: a team of up to 5 specialist Bots and up to 10 standing jobs, each given to one of them on a schedule. Each Bot gets only the tools its jobs need, at most ${MAX_BOT_TOOLS}, chosen from business_brief's tools. Each job's instruction is what its Bot is told when it runs, so write it as a complete task. Replaces the old plan; a Bot that keeps its key keeps its settings. Nothing runs until the person turns jobs on from Today. The person approves first.`,
    inputSchema: {
      type: "object",
      properties: {
        team: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description:
                  "A short slug, such as front-desk. Keep it when changing a Bot.",
              },
              name: { type: "string", description: "Such as 'Front desk'." },
              title: {
                type: "string",
                description:
                  "One line, such as 'Answers appointment requests'.",
              },
              role: {
                type: "string",
                description:
                  "Its standing role: what it does, for whom, and what it leaves to people.",
              },
              tools: {
                type: "array",
                maxItems: MAX_BOT_TOOLS,
                items: { type: "string" },
                description:
                  "Tool refs like crm/find_bids, from business_brief's tools.",
              },
            },
            required: ["name", "title", "role", "tools"],
          },
        },
        items: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description:
                  "A short slug. Keep an existing job's id when changing it.",
              },
              title: {
                type: "string",
                description: "Such as 'Monday lead list'.",
              },
              why: {
                type: "string",
                description: "One sentence tying it to the brief's goals.",
              },
              cron: {
                type: "string",
                description:
                  "Five fields in the person's time zone, such as '0 8 * * 1' for Mondays at 8:00.",
              },
              instruction: {
                type: "string",
                description: "The whole task, under 1,800 characters.",
              },
              bot: {
                type: "string",
                description: "The team key of the Bot that does it.",
              },
              actions: {
                type: "array",
                maxItems: 8,
                items: { type: "string" },
                description:
                  "The write tools this job uses, which the person may let its Bot do without asking.",
              },
            },
            required: ["title", "why", "cron", "instruction"],
          },
        },
      },
      required: ["items"],
    },
  },
]);

export const BUSINESS_TOOL_NAMES = BUSINESS_TOOLS.map((tool) => tool.name);
export const BUSINESS_WRITE_TOOLS = ["save_business_brief", "save_work_plan"];

async function sizeOf(records: CrmRecords, actor: AuthenticatedActor) {
  const total = (resource: string, filter: Record<string, unknown> = {}) =>
    records
      .list(actor, resource, { filter, perPage: 1 })
      .then((page) => page.total)
      .catch(() => null);
  const [contacts, companies, deals, wonDeals, lostDeals] = await Promise.all([
    total("contacts"),
    total("companies"),
    total("deals", { "archived_at@is": null }),
    total("deals", { stage: "won", "archived_at@is": null }),
    total("deals", { stage: "lost", "archived_at@is": null }),
  ]);
  const openDeals =
    deals === null ? null : deals - (wonDeals ?? 0) - (lostDeals ?? 0);
  return { contacts, companies, open_deals: openDeals, won_deals: wonDeals };
}

/** The tools a team Bot may be given, by app, with the CRM's writes marked. */
function byApp(refs: string[], crmWrites: ReadonlySet<string>) {
  const apps = new Map<string, string[]>();
  for (const ref of refs) {
    const [app = "", tool = ""] = ref.split("/");
    apps.set(app, [...(apps.get(app) ?? []), tool]);
  }
  return [...apps].map(([app, tools]) => ({
    app,
    tools: tools.slice(0, MAX_TOOLS_PER_APP),
    ...(app === "crm"
      ? { writes: tools.filter((tool) => crmWrites.has(tool)) }
      : {}),
    ...(tools.length > MAX_TOOLS_PER_APP
      ? { more: tools.length - MAX_TOOLS_PER_APP }
      : {}),
  }));
}

export async function runBusinessTool(
  database: Database,
  records: CrmRecords,
  actor: AuthenticatedActor,
  toolName: string,
  args: Record<string, unknown>,
  context: BusinessToolContext,
): Promise<Outcome | null> {
  switch (toolName) {
    case "business_brief": {
      const [brief, plan, crm, held] = await Promise.all([
        readBrief(database),
        readPlan(database),
        sizeOf(records, actor),
        context.heldTools?.().catch(() => []) ?? Promise.resolve([]),
      ]);
      return {
        ok: true,
        value: {
          brief: brief?.text ?? null,
          brief_updated: brief?.updatedAt ?? null,
          team: plan?.team.map((member) => ({
            key: member.key,
            name: member.name,
            title: member.title,
            role: member.role,
            tools: member.tools,
          })),
          work_plan: plan
            ? plan.items.map((item) => ({
                ...itemSummary(item),
                cron: item.cron,
                instruction: item.instruction,
                bot: item.bot,
                actions: item.actions,
              }))
            : null,
          tools: byApp(held, new Set(context.crmWriteTools)),
          crm,
        },
      };
    }
    case "save_business_brief": {
      const text = typeof args.brief === "string" ? args.brief.trim() : "";
      if (!text) return { ok: false, message: "Give the brief's text." };
      const brief = await saveBrief(database, text, actor.email);
      return {
        ok: true,
        value: {
          saved: true,
          characters: brief.text.length,
          note: "Every Bot reads this from its next run.",
        },
      };
    }
    case "save_work_plan": {
      const checked = checkPlan(args, await readPlan(database));
      if (!checked.ok) return { ok: false, message: checked.message };
      if (context.heldTools) {
        const held = new Set(await context.heldTools());
        const unknown = checked.team
          .flatMap((member) => member.tools)
          .find((ref) => !held.has(ref));
        if (unknown) {
          return {
            ok: false,
            message: `${unknown} isn't a tool you hold, so no team Bot can be given it. Use the tools business_brief lists.`,
          };
        }
      }
      await savePlan(
        database,
        { team: checked.team, items: checked.plan },
        actor.email,
      );
      const items = checked.plan.map((item) => ({
        ...itemSummary(item),
        bot:
          checked.team.find((member) => member.key === item.bot)?.name ??
          "the main Bot",
      }));
      return {
        ok: true,
        value: {
          team: checked.team.map((member) => member.name),
          saved: items,
          runs_per_month: items.reduce(
            (sum, item) => sum + item.runs_per_month,
            0,
          ),
          next: "Nothing runs yet. The person turns each job on from Today, which creates its Bot. It runs as them.",
        },
      };
    }
    default:
      return null;
  }
}
