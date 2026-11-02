import type { DraftStreamEvent } from "./kontract-api";

/*
 * Kontract's engine API: government bids, permits, bid documents and past awards, loaded once for
 * every workspace. Each call names this workspace for Kontract's metering, and a paid call reports
 * its cost in X-Kontract-Cost-Micro (a draft stream reports it in its last event).
 */

export type GovconConfig = {
  url: string | undefined;
  serviceKey: string | undefined;
  workspaceId: string;
  monthlyBudgetUsd: number;
};

export class KontractError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // What a failed draft had already spent.
    readonly costMicro = 0,
  ) {
    super(message);
  }
}

export type KontractResult<TData> = { data: TData; costMicro: number };

type Request = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

/** Kontract wants `[a-z0-9-]{1,64}`; DEPLOYMENT_ID is `magpie-<slug>`. */
export function workspaceIdOf(deploymentId: string | undefined): string {
  const id = (deploymentId ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return id || "magpie";
}

export const isConfigured = (config: GovconConfig | undefined) =>
  !!config?.url && !!config.serviceKey;

function urlFor(config: GovconConfig, path: string, query: Request["query"]) {
  const url = new URL(`/api/v1${path}`, config.url);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  }
  return url;
}

async function send(
  config: GovconConfig,
  path: string,
  request: Request,
  fetchImpl: typeof fetch,
): Promise<Response> {
  if (!isConfigured(config)) {
    throw new KontractError(
      "Government bids aren't set up in this workspace.",
      503,
    );
  }
  try {
    return await fetchImpl(urlFor(config, path, request.query), {
      method: request.method ?? (request.body === undefined ? "GET" : "POST"),
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        "X-Workspace-Id": config.workspaceId,
        ...(request.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(request.body === undefined
        ? {}
        : { body: JSON.stringify(request.body) }),
      signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new KontractError(
      timedOut
        ? "The bid service took too long to answer. Try again in a minute."
        : "Couldn't reach the bid service. Try again in a minute.",
      502,
    );
  }
}

async function refusal(response: Response): Promise<KontractError> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  const said = typeof body?.error === "string" ? body.error : null;
  if (response.status === 401) {
    return new KontractError(
      "The bid service refused this workspace's key. Ask the admin.",
      401,
    );
  }
  if (response.status === 429) {
    const wait = response.headers.get("retry-after");
    return new KontractError(
      `The bid service is busy. Wait ${wait ? `${wait} seconds` : "a minute"} and try again.`,
      429,
    );
  }
  return new KontractError(
    said ?? `The bid service failed (${response.status}).`,
    response.status,
  );
}

export async function kontractCall<TData>(
  config: GovconConfig,
  path: string,
  request: Request = {},
  fetchImpl: typeof fetch = fetch,
): Promise<KontractResult<TData>> {
  const response = await send(config, path, request, fetchImpl);
  if (!response.ok) throw await refusal(response);
  const cost = Number(response.headers.get("x-kontract-cost-micro") ?? 0);
  return {
    data: (await response.json()) as TData,
    costMicro: Number.isFinite(cost) && cost > 0 ? cost : 0,
  };
}

/** A draft streams as NDJSON; this reads it to the end. */
export async function kontractDraft(
  config: GovconConfig,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<
  KontractResult<{ text: string; source: "claude" | "template" | null }>
> {
  const response = await send(
    config,
    "/drafts",
    { body, timeoutMs: 180_000 },
    fetchImpl,
  );
  if (!response.ok) throw await refusal(response);
  let text = "";
  let source: "claude" | "template" | null = null;
  let costMicro = 0;
  let failed: string | null = null;
  for (const line of (await response.text()).split("\n")) {
    if (!line.trim()) continue;
    let event: DraftStreamEvent;
    try {
      event = JSON.parse(line) as DraftStreamEvent;
    } catch {
      continue;
    }
    if (event.type === "meta") source = event.source;
    else if (event.type === "text") text += event.text;
    else if (event.type === "done")
      costMicro = Math.max(0, Number(event.costMicro) || 0);
    else if (event.type === "error") failed = event.message;
  }
  if (failed) throw new KontractError(failed, 502, costMicro);
  return { data: { text, source }, costMicro };
}
