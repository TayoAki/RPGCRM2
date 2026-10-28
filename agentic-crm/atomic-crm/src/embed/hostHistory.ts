import {
  createPath,
  NavigationType,
  type HistoryRouterProps,
  type Location,
  type To,
} from "react-router";

type RouterHistory = HistoryRouterProps["history"];

export type HostLocation = {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
};

export type HostHistoryAction = { type: string; index?: number };

// The subset of a TanStack Router history the CRM needs, so it can follow the host's URL.
export type HostHistory = {
  readonly location: HostLocation;
  push: (path: string, state?: unknown) => void;
  replace: (path: string, state?: unknown) => void;
  go: (delta: number) => void;
  createHref: (href: string) => string;
  subscribe: (
    listener: (event: {
      location: HostLocation;
      action: HostHistoryAction;
    }) => void,
  ) => () => void;
};

const HOST_STATE_KEYS = new Set(["key", "__TSR_key", "__TSR_index"]);

const toLocation = (location: HostLocation): Location => {
  const state = isRecord(location.state) ? location.state : {};
  const userState = Object.fromEntries(
    Object.entries(state).filter(([key]) => !HOST_STATE_KEYS.has(key)),
  );
  return {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    state: Object.keys(userState).length > 0 ? userState : null,
    key: String(state.__TSR_key ?? state.key ?? "default"),
  };
};

const toNavigationType = (action: HostHistoryAction): NavigationType => {
  if (action.type === "PUSH") return NavigationType.Push;
  if (action.type === "REPLACE") return NavigationType.Replace;
  return NavigationType.Pop;
};

const toPath = (to: To) => (typeof to === "string" ? to : createPath(to));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// One URL, two routers: react-router reads and writes through the host's history
// instead of window.history, so neither router misses the other's navigations.
export const createHostRouterHistory = (host: HostHistory): RouterHistory => {
  let action = NavigationType.Pop;

  const createURL = (to: To) =>
    new URL(host.createHref(toPath(to)), window.location.origin);

  return {
    get action() {
      return action;
    },
    get location() {
      return toLocation(host.location);
    },
    createHref: (to) => host.createHref(toPath(to)),
    createURL,
    encodeLocation: (to) => {
      const url = createURL(to);
      return { pathname: url.pathname, search: url.search, hash: url.hash };
    },
    push: (to, state) => host.push(toPath(to), state),
    replace: (to, state) => host.replace(toPath(to), state),
    go: (delta) => host.go(delta),
    listen: (listener) =>
      host.subscribe((event) => {
        action = toNavigationType(event.action);
        listener({
          action,
          location: toLocation(event.location),
          delta:
            event.action.type === "GO" ? (event.action.index ?? null) : null,
        });
      }),
  };
};
