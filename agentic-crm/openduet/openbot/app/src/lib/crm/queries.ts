import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";

export type CrmDeal = {
  id: number;
  name: string;
  stage: string;
  amount: number;
  company_id: number | null;
  created_at: string;
  updated_at: string;
};

export type CrmFollowUp = {
  id: number;
  contact_id: number;
  type: string | null;
  text: string | null;
  due_date: string | null;
};

export type CrmMeeting = {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  contact_id: number | null;
  deal_id: number | null;
};

export type CrmStage = { value: string; label: string };

export type CrmConfig = {
  title?: string;
  currency?: string;
  dealStages?: CrmStage[];
  dealPipelineStatuses?: string[];
};

export type CrmSearchResult = {
  resource:
    | "companies"
    | "contacts"
    | "deals"
    | "tasks"
    | "contact_notes"
    | "deal_notes";
  record_id: number;
  title: string | null;
  subtitle: string | null;
  contact_id: number | null;
  deal_id: number | null;
};

export type CrmActivity = {
  id: string;
  type:
    | "company.created"
    | "contact.created"
    | "contactNote.created"
    | "deal.created"
    | "dealNote.created";
  date: string | null;
  sales_id: number | null;
  company: { id: number; name: string } | null;
  contact: {
    id: number;
    first_name: string | null;
    last_name: string | null;
  } | null;
  deal: { id: number; name: string } | null;
  contact_note: { contact_id: number; text: string | null } | null;
  deal_note: { deal_id: number; text: string | null } | null;
};

export type CrmSale = {
  id: number;
  first_name: string | null;
  last_name: string | null;
};

type ListQuery = {
  filter?: Record<string, unknown>;
  sort?: string;
  order?: "ASC" | "DESC";
  perPage?: number;
};

async function crmList<TRow>(
  resource: string,
  { filter = {}, sort, order = "DESC", perPage = 25 }: ListQuery,
  fallback: string,
): Promise<{ data: TRow[]; total: number }> {
  const query = new URLSearchParams({
    filter: JSON.stringify(filter),
    page: "1",
    perPage: String(perPage),
  });
  if (sort) {
    query.set("sort", sort);
    query.set("order", order);
  }
  const response = await client(`/api/crm/${resource}?${query}`, {
    fallback,
  });
  return response.json();
}

export const crmKeys = {
  all: ["crm"] as const,
  deals: ["crm", "home", "deals"] as const,
  me: ["crm", "home", "me"] as const,
  followUps: (saleId: number | undefined) =>
    ["crm", "home", "follow-ups", saleId] as const,
  meetings: ["crm", "home", "meetings"] as const,
  configuration: ["crm", "home", "configuration"] as const,
  activity: ["crm", "home", "activity"] as const,
  sales: ["crm", "home", "sales"] as const,
  contactCount: ["crm", "home", "contact-count"] as const,
  search: (text: string) => ["crm", "home", "search", text] as const,
};

const CLOSED_STAGES = ["won", "lost"];

// The CRM's own defaults, for a workspace whose admin never saved its stages.
const DEFAULT_STAGES: CrmStage[] = [
  { value: "opportunity", label: "Opportunity" },
  { value: "proposal-sent", label: "Proposal sent" },
  { value: "in-negociation", label: "In negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "delayed", label: "Delayed" },
];

export function dealStages(config: CrmConfig | undefined): CrmStage[] {
  return config?.dealStages?.length ? config.dealStages : DEFAULT_STAGES;
}

/** Stages a deal is finished in: won, lost, and any the admin marked as out of the pipeline. */
export function closedStages(config: CrmConfig | undefined): string[] {
  return [...CLOSED_STAGES, ...(config?.dealPipelineStatuses ?? [])];
}

export function stageLabel(stage: string, config: CrmConfig | undefined) {
  const known = dealStages(config).find((each) => each.value === stage);
  if (known) return known.label;
  const words = stage.replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Every deal not archived, newest change first. The pipeline is a few hundred deals at most. */
export const crmDealsQueryOptions = () =>
  queryOptions({
    queryKey: crmKeys.deals,
    queryFn: () =>
      crmList<CrmDeal>(
        "deals",
        {
          filter: { "archived_at@is": null },
          sort: "updated_at",
          perPage: 500,
        },
        "Couldn't load your deals.",
      ),
    staleTime: 60_000,
  });

/** The person's own record in the CRM, whose id their follow-ups and deals carry. */
export const crmMeQueryOptions = () =>
  queryOptions({
    queryKey: crmKeys.me,
    queryFn: () =>
      client<{ id: number; first_name: string | null }>("/api/crm/me", "data", {
        fallback: "Couldn't load your CRM profile.",
      }),
    staleTime: 5 * 60_000,
  });

/** The person's follow-ups not done and due by the end of today, oldest first. */
export const crmFollowUpsQueryOptions = (saleId: number | undefined) =>
  queryOptions({
    queryKey: crmKeys.followUps(saleId),
    enabled: saleId !== undefined,
    queryFn: () => {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      return crmList<CrmFollowUp>(
        "tasks",
        {
          filter: {
            sales_id: saleId,
            "done_date@is": null,
            "due_date@lte": endOfToday.toISOString(),
          },
          sort: "due_date",
          order: "ASC",
          perPage: 50,
        },
        "Couldn't load your follow-ups.",
      );
    },
    staleTime: 60_000,
  });

/** The next scheduled meetings. */
export const crmMeetingsQueryOptions = () =>
  queryOptions({
    queryKey: crmKeys.meetings,
    queryFn: () =>
      crmList<CrmMeeting>(
        "meetings",
        {
          filter: {
            "start_at@gte": new Date().toISOString(),
            status: "scheduled",
          },
          sort: "start_at",
          order: "ASC",
          perPage: 5,
        },
        "Couldn't load your meetings.",
      ),
    staleTime: 60_000,
  });

/** The newest companies, contacts, deals and notes anyone on the team added. */
export const crmActivityQueryOptions = () =>
  queryOptions({
    queryKey: crmKeys.activity,
    queryFn: () =>
      crmList<CrmActivity>(
        "activity_log",
        { sort: "date", perPage: 15 },
        "Couldn't load the team's activity.",
      ),
    staleTime: 60_000,
  });

/** How many contacts the workspace has, for the first-run checklist. */
export const crmContactCountQueryOptions = () =>
  queryOptions({
    queryKey: crmKeys.contactCount,
    queryFn: async () =>
      (
        await crmList<{ id: number }>(
          "contacts",
          { perPage: 1 },
          "Couldn't count your contacts.",
        )
      ).total,
    staleTime: 60_000,
  });

export const crmSalesQueryOptions = () =>
  queryOptions({
    queryKey: crmKeys.sales,
    queryFn: () =>
      crmList<CrmSale>("sales", { perPage: 200 }, "Couldn't load your team."),
    staleTime: 5 * 60_000,
  });

export const crmConfigurationQueryOptions = () =>
  queryOptions({
    queryKey: crmKeys.configuration,
    queryFn: async (): Promise<CrmConfig> => {
      const row = await client<{ config?: CrmConfig }>(
        "/api/crm/configuration/1",
        "data",
        { fallback: "Couldn't load the CRM's settings." },
      );
      return row?.config ?? {};
    },
    staleTime: 5 * 60_000,
  });

export const crmSearchQueryOptions = (text: string) =>
  queryOptions({
    queryKey: crmKeys.search(text),
    queryFn: () =>
      client<CrmSearchResult[]>(
        `/api/crm/search?${new URLSearchParams({
          q: text,
          resources: "contacts,companies,deals",
          max: "6",
        })}`,
        "data",
        { fallback: "Couldn't search the CRM." },
      ),
    enabled: text.trim().length > 1,
    staleTime: 30_000,
  });
