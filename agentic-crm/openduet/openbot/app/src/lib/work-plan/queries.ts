import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";

export type JobAction = {
  ref: string;
  label: string;
  withoutAsking: boolean;
};

export type TeamBot = {
  key: string;
  name: string;
  title: string;
  /** Null until its first job is turned on. */
  botId: string | null;
  tools: number;
};

export type PlanJob = {
  id: string;
  title: string;
  why: string;
  /** Its team Bot's key, or null for the main Bot. */
  bot: string | null;
  actions: JobAction[];
  schedule: string;
  runsPerMonth: number;
  on: boolean;
  nextRunAt: string | null;
  lastRun: { status: string | null; finishedAt: string | null } | null;
};

export type WeekReport = {
  since: string;
  botRuns: {
    total: number;
    succeeded: number;
    failed: number;
    waiting: number;
  };
  results: {
    newContacts: number;
    meetingsBooked: number;
    dealsMoved: number;
    dealsWon: number;
    replies: number;
  };
  waiting: { drafts: number };
};

export type WorkPlan = {
  botId: string;
  /** Whether this person may let a Bot act without asking: admins only. */
  canAllow: boolean;
  brief: { updatedAt: string; preview: string } | null;
  plan: { savedAt: string; team: TeamBot[]; items: PlanJob[] } | null;
  runsPerMonthOn: number;
  runsPerSeat: number;
  instructions: { brief: string; plan: string };
  week: WeekReport;
};

export const workPlanKeys = { all: ["work-plan"] as const };

export const workPlanQueryOptions = () =>
  queryOptions({
    queryKey: workPlanKeys.all,
    queryFn: () =>
      client<WorkPlan>("/api/work-plan", "data", {
        fallback: "Couldn't load the work plan.",
      }),
    staleTime: 60_000,
  });
