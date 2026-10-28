import {
  Link,
  Route,
  Routes,
  unstable_HistoryRouter as HistoryRouter,
  useLocation,
  useNavigate,
} from "react-router";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  createHostRouterHistory,
  type HostHistory,
  type HostHistoryAction,
  type HostLocation,
} from "./hostHistory";

type Entry = { path: string; state: Record<string, unknown> };

// Behaves like TanStack Router's memory history, including the keys it adds to state.
const createMemoryHostHistory = (initialPath: string): HostHistory => {
  const entries: Entry[] = [{ path: initialPath, state: { __TSR_index: 0 } }];
  let index = 0;
  const listeners = new Set<
    (event: { location: HostLocation; action: HostHistoryAction }) => void
  >();
  const current = (): HostLocation => {
    const url = new URL(entries[index].path, "http://host.test");
    return {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      state: entries[index].state,
    };
  };
  const notify = (type: string) =>
    listeners.forEach((listener) =>
      listener({ location: current(), action: { type } }),
    );
  return {
    get location() {
      return current();
    },
    push: (path, state) => {
      entries.splice(index + 1);
      entries.push({
        path,
        state: { ...(state as object), __TSR_key: "k", __TSR_index: index + 1 },
      });
      index += 1;
      notify("PUSH");
    },
    replace: (path, state) => {
      entries[index] = { path, state: { ...(state as object) } };
      notify("REPLACE");
    },
    go: (delta) => {
      index += delta;
      notify(delta < 0 ? "BACK" : "FORWARD");
    },
    createHref: (href) => href,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const Home = () => {
  const navigate = useNavigate();
  return (
    <>
      <p>Home page</p>
      <Link to="/contacts">Contacts</Link>
      <button
        type="button"
        onClick={() => navigate("/deals", { state: { stage: "won" } })}
      >
        Won deals
      </button>
    </>
  );
};

const Deals = () => {
  const { state } = useLocation();
  return <p>Deals page, state: {JSON.stringify(state)}</p>;
};

const renderCrm = (host: HostHistory) =>
  render(
    <HistoryRouter basename="/crm" history={createHostRouterHistory(host)}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contacts" element={<p>Contacts page</p>} />
        <Route path="/deals" element={<Deals />} />
      </Routes>
    </HistoryRouter>,
  );

describe("createHostRouterHistory", () => {
  it("gives CRM links an address under the basename", async () => {
    const screen = await renderCrm(createMemoryHostHistory("/crm"));

    await expect
      .element(screen.getByRole("link", { name: "Contacts" }))
      .toHaveAttribute("href", "/crm/contacts");
  });

  it("navigates the host history when the CRM follows a link", async () => {
    const host = createMemoryHostHistory("/crm");
    const screen = await renderCrm(host);

    await screen.getByRole("link", { name: "Contacts" }).click();

    await expect.element(screen.getByText("Contacts page")).toBeVisible();
    expect(host.location.pathname).toBe("/crm/contacts");
  });

  it("follows navigations the host router makes", async () => {
    const host = createMemoryHostHistory("/crm");
    const screen = await renderCrm(host);

    host.push("/crm/contacts");

    await expect.element(screen.getByText("Contacts page")).toBeVisible();
  });

  it("returns to the previous CRM page when the host goes back", async () => {
    const host = createMemoryHostHistory("/crm");
    const screen = await renderCrm(host);
    await screen.getByRole("link", { name: "Contacts" }).click();
    await expect.element(screen.getByText("Contacts page")).toBeVisible();

    host.go(-1);

    await expect.element(screen.getByText("Home page")).toBeVisible();
  });

  it("passes navigation state through without the host's own keys", async () => {
    const screen = await renderCrm(createMemoryHostHistory("/crm"));

    await screen.getByRole("button", { name: "Won deals" }).click();

    await expect
      .element(screen.getByText('Deals page, state: {"stage":"won"}'))
      .toBeVisible();
  });
});
