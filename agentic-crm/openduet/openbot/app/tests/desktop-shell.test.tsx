import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { daySummary } from "@/components/desktop/assistant-panel";
import {
  breadcrumbFor,
  DesktopShell,
} from "@/components/desktop/desktop-shell";
import type { WorkspaceSummary } from "@/components/desktop/use-workspace-summary";
import { TodayScreen } from "@/components/today/today-screen";
import { agentKeys } from "@/lib/agents/queries";
import { authKeys } from "@/lib/auth/queries";
import { settleReactWork } from "./settle-react-work";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost:3010" }));
afterEach(cleanup);
afterEach(() => window.localStorage.clear());
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const NOW = new Date();
const yesterday = new Date(NOW.getTime() - 86_400_000).toISOString();
const LONG_AGO = "2020-01-01T00:00:00Z";
const inAnHour = new Date(NOW.getTime() + 3_600_000).toISOString();

let started: unknown = null;

function serving({ empty = false } = {}) {
  started = null;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.split("?")[0];
    if (path === "/api/openduet/tasks" && init?.method === "POST") {
      started = JSON.parse(String(init.body));
      return Response.json({ task: { id: "task-new", status: "working" } });
    }
    if (path === "/api/approvals")
      return Response.json({
        requests: empty
          ? []
          : [
              {
                id: "a1",
                status: "pending",
                createdAt: yesterday,
                action: {
                  botId: "magpie",
                  toolRef: "gmail/GMAIL_SEND_EMAIL",
                  effect: "write",
                  scope: "ana@example.com",
                  threadId: "t",
                  args: {
                    to: "ana@example.com",
                    subject: "Ship date",
                    body: "Hi",
                  },
                  target: {},
                },
              },
            ],
        questions: [],
      });
    if (path === "/api/openduet/tasks")
      return Response.json({
        tasks: empty
          ? []
          : [
              {
                id: "t1",
                title: "Research Acme",
                status: "working",
                next: "Reading their site",
                createdAt: yesterday,
                updatedAt: yesterday,
                resolvedAt: null,
              },
            ],
      });
    if (path === "/api/crm/me") return Response.json({ data: { id: 7 } });
    if (path === "/api/crm/configuration/1")
      return Response.json({
        data: {
          id: 1,
          config: {
            title: "Acme Studio",
            currency: "USD",
            dealStages: [
              { value: "opportunity", label: "Opportunity" },
              { value: "proposal-sent", label: "Proposal sent" },
              { value: "won", label: "Won" },
            ],
          },
        },
      });
    if (path === "/api/crm/deals")
      return Response.json({
        data: empty
          ? []
          : [
              {
                id: 1,
                name: "Big",
                stage: "proposal-sent",
                amount: 9000,
                created_at: NOW.toISOString(),
                updated_at: yesterday,
              },
              {
                id: 2,
                name: "Small",
                stage: "opportunity",
                amount: 1000,
                created_at: LONG_AGO,
                updated_at: yesterday,
              },
              {
                id: 3,
                name: "Done",
                stage: "won",
                amount: 50000,
                created_at: yesterday,
                updated_at: yesterday,
              },
            ],
        total: empty ? 0 : 3,
      });
    if (path === "/api/crm/tasks")
      return Response.json({
        data: empty
          ? []
          : [
              {
                id: 4,
                contact_id: 9,
                type: "call",
                text: "Call Ana back",
                due_date: yesterday,
              },
            ],
        total: empty ? 0 : 1,
      });
    if (path === "/api/crm/meetings")
      return Response.json({
        data: empty
          ? []
          : [
              {
                id: 5,
                title: "Acme kickoff",
                start_at: inAnHour,
                end_at: null,
                location: "Zoom",
                contact_id: null,
                deal_id: null,
              },
            ],
        total: empty ? 0 : 1,
      });
    if (path === "/api/crm/activity_log" || path === "/api/crm/sales")
      return Response.json({ data: [], total: 0 });
    if (path === "/api/plugins/connections")
      return Response.json({
        connections: [
          { serverId: "composio-gmail", scope: "", connectedAt: yesterday },
        ],
        redirectUri: null,
      });
    return Response.json({});
  }) as unknown as typeof fetch;
}

function draw(ui: ReactNode, path = "/today") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(authKeys.currentUser(), {
    id: "u",
    email: "alex@example.com",
    name: "Alex Rivera",
    role: "admin",
    onboarding: null,
  });
  client.setQueryData(agentKeys.list(), [
    {
      id: "magpie",
      name: "Magpie",
      title: "",
      roleDescription: "",
      visibility: "public",
    },
  ]);
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

test("the breadcrumb names the area and the page", () => {
  expect(breadcrumbFor("/today", null, null)).toEqual(["Workspace", "Today"]);
  expect(breadcrumbFor("/", "chat", null)).toEqual(["Workspace", "Chat"]);
  expect(breadcrumbFor("/tasks/t1", "tasks", null)).toEqual([
    "Workspace",
    "Bot work",
  ]);
  expect(breadcrumbFor("/crm/deals", null, "CRM")).toEqual(["CRM", "Deals"]);
  expect(breadcrumbFor("/crm/contacts/4/show", null, "CRM")).toEqual([
    "CRM",
    "Contacts",
  ]);
  expect(breadcrumbFor("/crm/o/tasks", null, "CRM")).toEqual([
    "CRM",
    "Follow-ups",
  ]);
  expect(breadcrumbFor("/crm", null, "CRM")).toEqual(["CRM", "Dashboard"]);
  expect(breadcrumbFor("/connections", null, "Connections")).toEqual([
    "Workspace",
    "Connections",
  ]);
});

test("the assistant sums up the day in one sentence", () => {
  const summary = (counts: {
    waiting: number;
    due: number;
    meetings: number;
  }) =>
    ({
      waiting: counts.waiting,
      followUpsDue: Array.from({ length: counts.due }),
      meetingsToday: Array.from({ length: counts.meetings }),
    }) as unknown as WorkspaceSummary;
  expect(daySummary(summary({ waiting: 0, due: 0, meetings: 0 }))).toBe(
    "Nothing needs you right now.",
  );
  expect(daySummary(summary({ waiting: 2, due: 1, meetings: 3 }))).toBe(
    "You have 2 things waiting on you, 1 follow-up due and 3 meetings today.",
  );
  expect(daySummary(summary({ waiting: 0, due: 4, meetings: 0 }))).toBe(
    "You have 4 follow-ups due.",
  );
});

test("Today greets the person and shows the pipeline, what needs them and what's next", async () => {
  serving();
  const view = draw(<TodayScreen view="overview" />);
  expect(await view.findByRole("heading", { name: /, Alex\.$/ })).toBeDefined();
  // Won deals are out of the pipeline: 9,000 + 1,000 open.
  expect(await view.findByText("$10,000")).toBeDefined();
  expect(view.getByText("2 deals, 1 new this month")).toBeDefined();
  const attention = view.getByRole("heading", { name: "Needs your attention" })
    .parentElement?.parentElement as HTMLElement;
  expect(await within(attention).findByText("Call Ana back")).toBeDefined();
  expect(within(attention).getByText("1 day late")).toBeDefined();
  expect(view.getByText("Proposal sent")).toBeDefined();
  expect(view.getByText("Opportunity")).toBeDefined();
  expect(view.queryByText("Won")).toBeNull();
  expect(view.getByText("Acme kickoff")).toBeDefined();
});

test("Today says so when nothing needs the person", async () => {
  serving({ empty: true });
  const view = draw(<TodayScreen view="overview" />);
  expect(await view.findByText("You're all caught up.")).toBeDefined();
  expect(view.getByText("No open deals yet. Add one in Deals.")).toBeDefined();
  expect(view.getByText("No meetings coming up.")).toBeDefined();
});

test("the desktop shell lists the places, counts what's waiting, and asks the Bot from the panel", async () => {
  serving();
  const view = draw(
    <DesktopShell onConversations={() => {}} tab={null}>
      <p>Page</p>
    </DesktopShell>,
  );
  const main = await view.findByRole("navigation", { name: "Main" });
  expect(within(main).getByRole("link", { name: "Today" })).toBeDefined();
  expect(within(main).getByRole("link", { name: "Contacts" })).toBeDefined();
  expect(await within(main).findByText("Acme Studio")).toBeDefined();
  expect(await within(main).findByText("1 app connected")).toBeDefined();
  expect(view.getByRole("navigation", { name: "Breadcrumb" }).textContent).toBe(
    "Workspace/Today",
  );
  const panel = view.getByRole("complementary", { name: "Magpie" });
  expect(await within(panel).findByText("Research Acme")).toBeDefined();
  expect(await view.findByText("1 Bot working")).toBeDefined();

  await userEvent.type(
    within(panel).getByLabelText("Ask Magpie"),
    "Find new leads",
  );
  await userEvent.click(within(panel).getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(started).toEqual({ botId: "magpie", instruction: "Find new leads" }),
  );
});

test("the assistant panel can be hidden and stays hidden", async () => {
  serving({ empty: true });
  const view = draw(
    <DesktopShell onConversations={() => {}} tab={null}>
      <p>Page</p>
    </DesktopShell>,
  );
  const panel = await view.findByRole("complementary", { name: "Magpie" });
  await userEvent.click(
    within(panel).getByRole("button", { name: "Hide the assistant" }),
  );
  expect(view.queryByRole("complementary")).toBeNull();
  cleanup();
  const again = draw(
    <DesktopShell onConversations={() => {}} tab={null}>
      <p>Page</p>
    </DesktopShell>,
  );
  await userEvent.click(
    await again.findByRole("button", { name: "Show the assistant" }),
  );
  expect(again.getByRole("complementary", { name: "Magpie" })).toBeDefined();
});
