import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadLists } from "@/components/today/lead-lists";
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

const BASE = {
  available: true,
  botId: "magpie",
  instruction: "Build this week's lead list.\n1. ...",
  leadSource: "Magpie prospecting",
  profile: null,
  leadsThisWeek: 0,
  draftsWaiting: 0,
  budget: { monthlyUsd: 10, spentUsd: 0 },
  routine: null as null | Record<string, unknown>,
};

let sent: { method: string; url: string; body: unknown }[] = [];

function serving(state: typeof BASE) {
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
    if (url === "/api/prospecting") return Response.json({ data: state });
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
    routeTree: createRootRoute({ component: () => <LeadLists /> }),
    history: createMemoryHistory({ initialEntries: ["/today"] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

test("nothing shows where lead lists aren't set up", async () => {
  serving({ ...BASE, available: false });
  const view = draw();
  await waitFor(() => expect(view.container.textContent).toBe(""));
});

test("the weekly list can be turned on, or a list made now", async () => {
  serving(BASE);
  const view = draw();
  await userEvent.click(
    await view.findByRole("button", { name: "Turn on weekly lead list" }),
  );
  await waitFor(() =>
    expect(sent[0]).toMatchObject({
      method: "POST",
      url: "/api/prospecting/routine",
      body: { timezone: expect.any(String) },
    }),
  );
  await userEvent.click(view.getByRole("button", { name: "Find leads now" }));
  await waitFor(() =>
    expect(sent[1]).toMatchObject({
      method: "POST",
      url: "/api/openduet/tasks",
      body: { botId: "magpie", instruction: BASE.instruction },
    }),
  );
});

test("once on, it says what's next, what it found and what it cost", async () => {
  serving({
    ...BASE,
    leadsThisWeek: 12,
    draftsWaiting: 5,
    budget: { monthlyUsd: 10, spentUsd: 2.4 },
    routine: {
      id: "routine-1",
      schedule: "Mondays at 08:00",
      enabled: true,
      nextRunAt: "2026-11-02T16:00:00.000Z",
    },
  });
  const view = draw();
  expect(
    await view.findByRole("heading", { name: "Weekly lead list" }),
  ).toBeDefined();
  expect(view.getByText(/12 new leads this week/)).toBeDefined();
  expect(view.getByText(/5 emails drafted for you to review/)).toBeDefined();
  expect(view.getByText(/\$2\.40 of \$10\.00 used this month/)).toBeDefined();
  const link = view.getByRole("link", { name: "View leads" });
  expect(decodeURIComponent(link.getAttribute("href") ?? "")).toBe(
    '/crm/contacts?filter={"lead_source":"Magpie prospecting"}',
  );
  await userEvent.click(view.getByRole("button", { name: "Turn off" }));
  await waitFor(() =>
    expect(sent[0]).toMatchObject({
      method: "DELETE",
      url: "/api/prospecting/routine",
    }),
  );
});
