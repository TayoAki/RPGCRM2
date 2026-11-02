import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { WeekReportCard, WorkPlanCard } from "@/components/today/work-plan";
import type { JobAction, WorkPlan } from "@/lib/work-plan/queries";
import { settleReactWork } from "./settle-react-work";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost:3010" }));
afterEach(cleanup);
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const WEEK: WorkPlan["week"] = {
  since: "2026-10-26T00:00:00Z",
  botRuns: { total: 0, succeeded: 0, failed: 0, waiting: 0 },
  results: {
    newContacts: 0,
    meetingsBooked: 0,
    dealsMoved: 0,
    dealsWon: 0,
    replies: 0,
  },
  waiting: { drafts: 0 },
};

const BASE: WorkPlan = {
  botId: "magpie",
  canAllow: false,
  brief: null,
  plan: null,
  runsPerMonthOn: 0,
  runsPerSeat: 400,
  instructions: { brief: "Get to know this business.", plan: "Plan the work." },
  week: WEEK,
};

const job = (id: string, on: boolean) => ({
  id,
  title: id === "lead-list" ? "Monday lead list" : "Friday pipeline review",
  why: "Feeds the retainer goal.",
  schedule: id === "lead-list" ? "Mondays at 08:00" : "Fridays at 16:00",
  runsPerMonth: 4,
  on,
  nextRunAt: null,
  lastRun: null,
  bot: null as string | null,
  actions: [] as JobAction[],
});

let sent: { method: string; url: string; body: unknown }[] = [];

function serving(state: WorkPlan) {
  sent = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      sent.push({
        method,
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
    }
    if (url === "/api/work-plan") return Response.json({ data: state });
    if (url === "/api/openduet/tasks")
      return Response.json({ task: { id: "task-1", status: "working" } });
    return Response.json({ data: {} });
  }) as unknown as typeof fetch;
}

function draw() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <>
          <WeekReportCard />
          <WorkPlanCard />
        </>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ["/today"] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

test("a new workspace is asked about its business, and Start hands the Bot the interview", async () => {
  serving(BASE);
  const view = draw();
  const start = await view.findByRole("button", { name: "Start" });

  expect(
    view.getByRole("heading", { name: "Tell Magpie about your business" }),
  ).toBeDefined();
  expect(view.queryByRole("heading", { name: "Last 7 days" })).toBeNull();
  fireEvent.click(start);
  await waitFor(() =>
    expect(sent).toContainEqual({
      method: "POST",
      url: "/api/openduet/tasks",
      body: { botId: "magpie", instruction: "Get to know this business." },
    }),
  );
});

test("with a brief and no plan, the Bot is asked to make one", async () => {
  serving({ ...BASE, brief: { updatedAt: "2026-11-02", preview: "UGC ads" } });
  const view = draw();
  fireEvent.click(await view.findByRole("button", { name: "Make a plan" }));

  await waitFor(() =>
    expect(sent).toContainEqual({
      method: "POST",
      url: "/api/openduet/tasks",
      body: { botId: "magpie", instruction: "Plan the work." },
    }),
  );
});

test("each job in the plan has its own switch, and Turn all on sends the time zone", async () => {
  serving({
    ...BASE,
    brief: { updatedAt: "2026-11-02", preview: "UGC ads" },
    plan: {
      savedAt: "2026-11-02",
      team: [],
      items: [job("lead-list", true), job("review", false)],
    },
    runsPerMonthOn: 4,
    week: {
      ...WEEK,
      botRuns: { total: 3, succeeded: 2, failed: 1, waiting: 0 },
      waiting: { drafts: 2 },
    },
  });
  const view = draw();
  const review = await view.findByRole("switch", {
    name: "Friday pipeline review: off",
  });

  expect(
    view.getByText(/1 of 2 jobs on, about 4 Bot runs a month/),
  ).toBeDefined();
  expect(
    view.getByText(/Bots ran 3 scheduled jobs, and 1 didn't finish/),
  ).toBeDefined();
  expect(view.getByText(/2 email drafts are waiting for you/)).toBeDefined();
  fireEvent.click(review);
  fireEvent.click(view.getByRole("switch", { name: "Monday lead list: on" }));
  fireEvent.click(view.getByRole("button", { name: "Turn all on" }));

  await waitFor(() => expect(sent).toHaveLength(3));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  expect(sent).toEqual([
    { method: "POST", url: "/api/work-plan/items/review", body: { timezone } },
    { method: "DELETE", url: "/api/work-plan/items/lead-list", body: null },
    { method: "POST", url: "/api/work-plan/on", body: { timezone } },
  ]);
});

test("jobs sit under the Bot that does them, and an admin picks what it may do without asking", async () => {
  serving({
    ...BASE,
    canAllow: true,
    brief: { updatedAt: "2026-11-02", preview: "Janitorial prime" },
    plan: {
      savedAt: "2026-11-02",
      team: [
        {
          key: "bids",
          name: "Bid desk",
          title: "Finds and tracks bids",
          botId: null,
          tools: 3,
        },
      ],
      items: [
        {
          ...job("find-bids", false),
          title: "Find this week's bids",
          bot: "bids",
          actions: [
            { ref: "crm/track_bid", label: "Track bid", withoutAsking: false },
            {
              ref: "crm/update_bid",
              label: "Update bid",
              withoutAsking: false,
            },
          ],
        },
        job("review", false),
      ],
    },
  });
  const view = draw();
  const findBids = await view.findByRole("switch", {
    name: "Find this week's bids: off",
  });

  expect(view.getByRole("heading", { name: "Bid desk" })).toBeDefined();
  expect(
    view.getByText(/Joins the team when you turn on its first job/),
  ).toBeDefined();
  expect(view.getByRole("heading", { name: "Main Bot" })).toBeDefined();
  fireEvent.click(findBids);
  fireEvent.click(await view.findByRole("checkbox", { name: "Track bid" }));
  fireEvent.click(view.getByRole("button", { name: "Turn on" }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    method: "POST",
    url: "/api/work-plan/items/find-bids",
    body: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      withoutAsking: ["crm/track_bid"],
    },
  });
});
