import type { RuntimeModel } from "../copilot";
import { anthropicMessagesUrl, chatCompletionsUrl } from "../routing/model";

export type WriteText = (input: {
  system: string;
  prompt: string;
  signal?: AbortSignal;
}) => Promise<string>;

export class NoModelKeyError extends Error {
  constructor() {
    super(
      "AI steps need a model key. Add OPENAI_API_KEY, or the key for the model this deployment uses.",
    );
  }
}

const TIMEOUT_MS = 120_000;
const ANTHROPIC_MAX_TOKENS = 4096;

/**
 * Writing text on the deployment's own model and key, the ones its Bots answer on: emails and
 * proposals for automations. Plain text in and out, unlike the router's JSON completer.
 */
export function createTextWriter(deps: {
  model: RuntimeModel;
  resolveApiKey: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}): WriteText {
  const fetchImpl = deps.fetchImpl ?? fetch;
  return async ({ system, prompt, signal }) => {
    const key = await deps.resolveApiKey();
    if (!key) throw new NoModelKeyError();
    const anthropic = deps.model.provider === "anthropic";
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetchImpl(
      anthropic
        ? anthropicMessagesUrl(process.env)
        : chatCompletionsUrl(process.env),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(anthropic
            ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
            : { authorization: `Bearer ${key}` }),
        },
        body: JSON.stringify(
          anthropic
            ? {
                model: deps.model.defaultModel,
                max_tokens: ANTHROPIC_MAX_TOKENS,
                system,
                messages: [{ role: "user", content: prompt }],
              }
            : {
                model: deps.model.defaultModel,
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: prompt },
                ],
              },
        ),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `The model answered ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      content?: { type?: string; text?: unknown }[];
    };
    const text = anthropic
      ? body.content
          ?.filter((block) => block.type === "text")
          .map((block) => String(block.text ?? ""))
          .join("")
      : body.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("The model returned no text.");
    }
    return text.trim();
  };
}
