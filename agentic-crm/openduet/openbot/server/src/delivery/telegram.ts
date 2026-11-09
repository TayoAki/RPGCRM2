import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ApprovalDecision } from "../approvals/types";
import { DELIVERY_REQUEST_TIMEOUT_MS } from "../timeouts";
import type { PairedApprovals } from "./opentag-agent";
import type { DeliveryRouter } from "./router";
import type { DeliveryStore } from "./store";
import {
  DeliveryProviderError,
  DeliveryRefusedError,
  type DeliveryScope,
  type ProviderFetch,
} from "./types";

/**
 * A Telegram bot as a delivery transport: a person links a private chat with the bot to one Bot in
 * one conversation, messages it there, and gets its replies, questions and approval requests back.
 * Each deployment uses its own bot, made with @BotFather, so the bot carries the business's name.
 */
export type TelegramConfig = {
  token: string;
  /** Echoed by Telegram in X-Telegram-Bot-Api-Secret-Token on every webhook call. */
  secret: string;
  webhookUrl: string;
  /** Where an approval's Review button opens; only an https URL is offered to Telegram. */
  reviewUrl?: string;
  fetch?: ProviderFetch;
};

const MAX_MESSAGE = 4096;
const APPROVAL_DATA = /^ap:([0-9a-f-]{36}):(once|deny)$/;
const LINK_CODE = /^[0-9a-f-]{36}$/;

export function telegramWebhookSecret(token: string, configured?: string) {
  return (
    configured?.trim() ||
    createHash("sha256")
      .update(`openbot-telegram-webhook:${token}`)
      .digest("hex")
  );
}

export function verifyTelegramRequest(received: string | null, secret: string) {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function chunks(text: string) {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > MAX_MESSAGE) {
    const cut = rest.lastIndexOf("\n", MAX_MESSAGE);
    const at = cut > MAX_MESSAGE / 2 ? cut : MAX_MESSAGE;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^\n/, "");
  }
  return [...parts, rest];
}

export function createTelegramTransport(config: TelegramConfig) {
  const wire = config.fetch ?? fetch;
  // The bot's own id, the part of its token before the colon, scopes every identity it sees.
  const realm = `bot${config.token.split(":")[0]}`;
  let username: Promise<string> | undefined;
  async function call<TResult>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<TResult> {
    let response: Response;
    try {
      response = await wire(
        `https://api.telegram.org/bot${config.token}/${method}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(DELIVERY_REQUEST_TIMEOUT_MS),
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
    } catch {
      throw new DeliveryProviderError("Telegram", "network_error", true);
    }
    let payload: { ok?: unknown; result?: unknown; error_code?: unknown } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {}
    if (!response.ok || payload.ok !== true)
      throw new DeliveryProviderError(
        "Telegram",
        response.status === 403
          ? "blocked"
          : String(payload.error_code ?? `HTTP_${response.status}`),
        response.status >= 500,
      );
    return payload.result as TResult;
  }
  const reviewButton =
    config.reviewUrl?.startsWith("https://") === true
      ? [{ text: "Review", url: config.reviewUrl }]
      : [];
  return {
    config,
    realm,
    username() {
      username ??= call<{ username?: string }>("getMe", {}).then((me) => {
        if (!me.username)
          throw new DeliveryProviderError("Telegram", "missing_username");
        return me.username;
      });
      username.catch(() => {
        username = undefined;
      });
      return username;
    },
    async send(input: {
      id: string;
      address: string;
      text: string;
      kind?: "reply" | "question" | "approval";
      requestId?: string | null;
    }) {
      const buttons =
        input.kind === "approval" && input.requestId
          ? {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Allow once",
                      callback_data: `ap:${input.requestId}:once`,
                    },
                    {
                      text: "Deny",
                      callback_data: `ap:${input.requestId}:deny`,
                    },
                  ],
                  ...(reviewButton.length ? [reviewButton] : []),
                ],
              },
            }
          : {};
      const parts = chunks(input.text);
      let first: string | undefined;
      for (const [index, part] of parts.entries()) {
        const sent = await call<{ message_id?: number }>("sendMessage", {
          chat_id: input.address,
          text: part,
          link_preview_options: { is_disabled: true },
          ...(index === parts.length - 1 ? buttons : {}),
        });
        first ??= String(sent.message_id ?? "");
      }
      if (!first)
        throw new DeliveryProviderError("Telegram", "missing_message_id", true);
      return { id: first, status: "sent" as const };
    },
    say(chatId: number | string, text: string) {
      return call("sendMessage", {
        chat_id: chatId,
        text,
        link_preview_options: { is_disabled: true },
      });
    },
    typing(chatId: number | string) {
      return call("sendChatAction", { chat_id: chatId, action: "typing" });
    },
    answerButton(callbackId: string, text: string) {
      return call("answerCallbackQuery", {
        callback_query_id: callbackId,
        text,
      });
    },
    settleButtons(chatId: number | string, messageId: number) {
      return call("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      });
    },
    registerWebhook() {
      return call("setWebhook", {
        url: config.webhookUrl,
        secret_token: config.secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      });
    },
  };
}
export type TelegramTransport = ReturnType<typeof createTelegramTransport>;

const person = z.object({ id: z.number().int() });
const chat = z.object({ id: z.number().int(), type: z.string() });
const updateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      from: person.optional(),
      chat,
      text: z.string().optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      from: person,
      data: z.string().optional(),
      message: z.object({ message_id: z.number().int(), chat }).optional(),
    })
    .optional(),
});

export type TelegramWebhookDeps = {
  telegram: TelegramTransport;
  router: Pick<DeliveryRouter, "receive">;
  store: Pick<
    DeliveryStore,
    | "readChallenge"
    | "consumeChallenge"
    | "bind"
    | "findBinding"
    | "removeBinding"
    | "botIdentity"
  >;
  scopeFor(
    owner: string,
    channelId: string,
    agentId: string,
  ): Promise<DeliveryScope | null>;
  approvals?: PairedApprovals;
  productName?: string;
};

/** Handles one verified update. Anything not from a private chat is ignored. */
export async function handleTelegramUpdate(
  deps: TelegramWebhookDeps,
  body: unknown,
) {
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return;
  const update = parsed.data;
  if (update.callback_query) return decide(deps, update.callback_query);
  const message = update.message;
  if (!message?.from || message.chat.type !== "private") return;
  const product = deps.productName ?? "OpenBot";
  const identity = String(message.from.id);
  const address = String(message.chat.id);
  const reply = (text: string) => deps.telegram.say(message.chat.id, text);
  const howTo = `To talk to a Bot here, open ${product}, go to the Bot's page, and choose Connect Telegram under Reaching you.`;
  const text = message.text?.trim() ?? "";
  const command = text.match(/^\/([a-z]+)(?:@\w+)?(?:\s+(\S+))?/i);
  const name = command?.[1]?.toLowerCase();

  if (name === "start" && command?.[2]) {
    await reply(
      await link(deps, { identity, address }, command[2].toLowerCase(), howTo),
    );
    return;
  }
  const binding = await deps.store.findBinding(
    "telegram",
    deps.telegram.realm,
    identity,
    address,
  );
  const owned =
    binding &&
    (
      await deps.scopeFor(
        binding.ownerUserId,
        binding.channelId,
        binding.agentId,
      )
    )?.threadId === binding.threadId
      ? binding
      : null;
  const botName = owned
    ? ((await deps.store.botIdentity(owned.agentId))?.name ?? "your Bot")
    : "";
  if (name === "stop") {
    if (!owned) return reply("This chat isn't connected to a Bot.");
    await deps.store.removeBinding(owned.ownerUserId, owned.id);
    await reply(
      `Disconnected. Messages here no longer reach ${botName}. Connect again from ${product} any time.`,
    );
    return;
  }
  if (!owned) return reply(howTo);
  if (name === "start" || name === "help") {
    await reply(
      `You're connected to ${botName}. Send a message to talk to it. Send /stop to disconnect.`,
    );
    return;
  }
  if (!text) {
    await reply("I can only read text messages here for now.");
    return;
  }
  if (deps.approvals) {
    const { questions } = await deps.approvals.inbox(owned.ownerUserId);
    const open = questions.find((q) => q.threadId === owned.threadId);
    if (open) {
      await deps.approvals.answerQuestion(owned.ownerUserId, open.id, text);
      await reply(`Thanks. I passed your answer to ${botName}.`);
      return;
    }
  }
  const queued = await deps.router.receive({
    source: "telegram",
    realm: deps.telegram.realm,
    identity,
    address,
    externalId: `${message.chat.id}:${message.message_id}`,
    text,
  });
  if (queued.queued)
    await deps.telegram.typing(message.chat.id).catch(() => {});
}

async function link(
  deps: TelegramWebhookDeps,
  sender: { identity: string; address: string },
  code: string,
  howTo: string,
) {
  const expired = `That link expired or was already used. ${howTo}`;
  if (!LINK_CODE.test(code)) return expired;
  const challenge = await deps.store.readChallenge(code);
  if (challenge?.transport !== "telegram") return expired;
  const scope = await deps.scopeFor(
    challenge.ownerUserId,
    challenge.channelId,
    challenge.agentId,
  );
  if (
    !scope ||
    scope.threadId !== challenge.threadId ||
    !(await deps.store.consumeChallenge(code, challenge.ownerUserId))
  )
    return `That conversation changed. ${howTo}`;
  try {
    await deps.store.bind({
      ...scope,
      transport: "telegram",
      realm: deps.telegram.realm,
      identity: sender.identity,
      address: sender.address,
    });
  } catch (error) {
    if (error instanceof DeliveryRefusedError) return error.message;
    throw error;
  }
  const bot = await deps.store.botIdentity(scope.agentId);
  return `Connected. Messages you send here now go to ${bot?.name ?? "your Bot"}, and its replies, questions and approval requests come here too. Send /stop to disconnect.`;
}

async function decide(
  deps: TelegramWebhookDeps,
  button: z.infer<typeof updateSchema>["callback_query"] & object,
) {
  const answer = (text: string) =>
    deps.telegram.answerButton(button.id, text).catch(() => {});
  const settle = () =>
    button.message
      ? deps.telegram
          .settleButtons(button.message.chat.id, button.message.message_id)
          .catch(() => {})
      : undefined;
  const choice = button.data?.match(APPROVAL_DATA);
  if (!choice || !deps.approvals) return answer("Nothing was decided.");
  const binding = await deps.store.findBinding(
    "telegram",
    deps.telegram.realm,
    String(button.from.id),
  );
  if (!binding)
    return answer("This chat isn't connected, so nothing was decided.");
  const approvalId = choice[1] as string;
  let record: Awaited<ReturnType<PairedApprovals["store"]["get"]>>;
  try {
    record = await deps.approvals.store.get(binding.ownerUserId, approvalId);
  } catch {
    await settle();
    return answer("That approval no longer exists.");
  }
  if (record.action.threadId !== binding.threadId)
    return answer("That approval belongs to another conversation.");
  if (record.status !== "pending") {
    await settle();
    return answer("That approval was already decided.");
  }
  const decision: ApprovalDecision =
    choice[2] === "once" ? "allow_once" : "deny";
  await deps.approvals.decide(binding.ownerUserId, approvalId, decision);
  await settle();
  const bot = await deps.store.botIdentity(record.action.botId);
  const name = bot?.name ?? "Your Bot";
  await answer(
    decision === "deny"
      ? `Denied. ${name} won't do it.`
      : `Allowed once. ${name} is continuing.`,
  );
}
