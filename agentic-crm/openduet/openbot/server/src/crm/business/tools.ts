import type { AuthenticatedActor } from "../../auth/guards";
import type { Database } from "../../db/client";
import type { McpTool } from "../../plugins/mcp";
import type { CrmRecords } from "../records";
import { MAX_BRIEF_CHARS, readBrief, saveBrief } from "./brief";
import { checkPlan, itemSummary, readPlan, savePlan } from "./plan";

type Outcome = { ok: true; value: unknown } | { ok: false; message: string };

export const BUSINESS_TOOLS: readonly McpTool[] = Object.freeze([
  {
    name: "business_brief",
    description:
      "The company brief every Bot works from, the current work plan, and how big the CRM is (contacts, companies, open and won deals). Read it before writing or changing either.",
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
    description:
      "Save the work plan: up to 10 standing jobs Bots do for the business, each on a schedule. Each job's instruction is what the Bot is told when it runs, so write it as a complete task using only tools you can see. Replaces the old plan. Nothing runs until the person turns jobs on from Today. The person approves first.",
    inputSchema: {
      type: "object",
      properties: {
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

export async function runBusinessTool(
  database: Database,
  records: CrmRecords,
  actor: AuthenticatedActor,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Outcome | null> {
  switch (toolName) {
    case "business_brief": {
      const [brief, plan, crm] = await Promise.all([
        readBrief(database),
        readPlan(database),
        sizeOf(records, actor),
      ]);
      return {
        ok: true,
        value: {
          brief: brief?.text ?? null,
          brief_updated: brief?.updatedAt ?? null,
          work_plan: plan
            ? plan.items.map((item) => ({
                ...itemSummary(item),
                cron: item.cron,
                instruction: item.instruction,
              }))
            : null,
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
      const checked = checkPlan(args);
      if (!checked.ok) return { ok: false, message: checked.message };
      await savePlan(database, checked.plan, actor.email);
      const items = checked.plan.map((item) => itemSummary(item));
      return {
        ok: true,
        value: {
          saved: items,
          runs_per_month: items.reduce(
            (sum, item) => sum + item.runs_per_month,
            0,
          ),
          next: "Nothing runs yet. The person turns each job on from Today, where it runs as them.",
        },
      };
    }
    default:
      return null;
  }
}
