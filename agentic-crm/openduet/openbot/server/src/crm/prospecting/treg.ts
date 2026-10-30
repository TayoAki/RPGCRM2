import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/*
 * treg (https://treg.to): one token for thousands of paid data tools. Prospecting uses three of its
 * calls: catalog_search and catalog_get over its MCP server (free), and a tool call over HTTP, which
 * reports its own price in X-Treg-Cost-Micro. See https://treg.to/skill.md.
 */

export const TREG_ORIGIN = "https://treg.to";

// Words in a tool id that mean it changes something or generates media rather than looks something
// up. Prospecting only looks things up, so these are refused before any money is spent.
const NOT_A_LOOKUP = new Set([
  "add",
  "adgroup",
  "adgroups",
  "audio",
  "budget",
  "campaign",
  "campaigns",
  "create",
  "delete",
  "disable",
  "edit",
  "enable",
  "generate",
  "generation",
  "image",
  "images",
  "music",
  "pause",
  "postiz",
  "publish",
  "remove",
  "schedule",
  "send",
  "set",
  "speech",
  "tts",
  "update",
  "upload",
  "video",
  "videos",
  "voice",
]);

/** Whether a catalog tool id is a lookup prospecting may pay for. */
export function isLookupTool(id: string): boolean {
  const trimmed = id.trim();
  // A team's own tools are addressed as `<name>/<path>` or by URL; prospecting uses the catalog only.
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(trimmed)) return false;
  return !trimmed
    .toLowerCase()
    .split(/[._-]+/)
    .some((part) => NOT_A_LOOKUP.has(part));
}

export class TregError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type TregCallResult = {
  status: number;
  data: unknown;
  costMicro: number;
  callId: string | null;
  servedBy: string | null;
};

/**
 * Call one catalog tool. A body is POSTed as JSON (routed `treg.*` tools take what you know about the
 * subject); otherwise the query is sent as a GET. The cost comes from treg's header, never the body.
 */
export async function tregCall(
  token: string,
  tool: string,
  input: {
    query?: Record<string, string | number | boolean>;
    body?: unknown;
    maxCostUsd: number;
    verify?: boolean;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<TregCallResult> {
  const url = new URL(`/call/${encodeURIComponent(tool)}`, TREG_ORIGIN);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = {
    "X-Treg-Token": token,
    "X-Treg-Route-Max-Cost": input.maxCostUsd.toFixed(4),
  };
  if (input.verify) headers["X-Treg-Route-Verify"] = "true";
  if (input.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetchImpl(url, {
    method: input.body === undefined ? "GET" : "POST",
    headers,
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Some providers answer in plain text; it is passed on as it came.
  }
  const costMicro = Number(response.headers.get("x-treg-cost-micro") ?? 0);
  if (!response.ok && response.status !== 202) {
    const reason =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : response.statusText;
    throw new TregError(
      `treg refused ${tool} (${response.status}): ${reason}`,
      response.status,
    );
  }
  return {
    status: response.status,
    data,
    costMicro: Number.isFinite(costMicro) ? costMicro : 0,
    callId: response.headers.get("x-treg-call-id"),
    servedBy: response.headers.get("x-treg-served-by"),
  };
}

/** catalog_search or catalog_get over treg's MCP server. Both are free. */
export async function tregCatalog(
  token: string,
  tool: "catalog_search" | "catalog_get",
  args: Record<string, unknown>,
): Promise<string> {
  const transport = new StreamableHTTPClientTransport(
    new URL("/mcp/", TREG_ORIGIN),
    { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const client = new Client({ name: "magpie-prospecting", version: "1.0.0" });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: tool, arguments: args });
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String(part.text)
          : "",
      )
      .join("\n")
      .trim();
    if (result.isError)
      throw new TregError(text || `treg ${tool} failed.`, 502);
    return text;
  } catch (error) {
    if (error instanceof TregError) throw error;
    throw new TregError(
      `Couldn't reach treg: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  } finally {
    await client.close().catch(() => {});
  }
}
