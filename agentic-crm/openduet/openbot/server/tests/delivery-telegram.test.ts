import { expect, test } from "bun:test";
import {
  configuredDeliveryProviders,
  createDeliveryWebhookRoutes,
} from "../src/delivery/routes";
import { createTelegramTransport } from "../src/delivery/telegram";
import type { DeliveryBinding } from "../src/delivery/types";

const TOKEN = "123456:AAH-abcdefghijklmnopqrstuvwxyz012345";
const SECRET = "s".repeat(40);
const CODE = "11111111-2222-4333-8444-555555555555";
const APPROVAL = "0f8fad5b-d9cb-469f-a165-70867728950e";
const bound: DeliveryBinding = {
  id: "b1",
  ownerUserId: "owner",
  channelId: "ch",
  agentId: "bot",
  threadId: "canonical",
  transport: "telegram",
  realm: "bot123456",
  identity: "42",
  address: "42",
  enabled: true,
};

function fixture(options: { bound?: boolean; question?: boolean } = {}) {
  const sent: { method: string; body: Record<string, unknown> }[] = [];
  const calls: unknown[] = [];
  const telegram = createTelegramTransport({
    token: TOKEN,
    secret: SECRET,
    webhookUrl: "https://o.test/api/delivery/webhooks/telegram",
    reviewUrl: "https://o.test/tasks",
    fetch: async (url, init) => {
      const method = String(url).split("/").pop() ?? "";
      const body = JSON.parse(String(init?.body ?? "{}"));
      sent.push({ method, body });
      const result =
        method === "getMe"
          ? { username: "MesaRidgeBot" }
          : method === "sendMessage"
            ? { message_id: sent.length }
            : true;
      return Response.json({ ok: true, result });
    },
  });
  const routes = createDeliveryWebhookRoutes({
    router: {
      receive: async (input) => {
        calls.push({ receive: input });
        return { queued: true };
      },
      notify: async () => {},
      smsOptOut: async () => 0,
      converse: async () => ({ kind: "unbound" }),
    },
    store: {
      readChallenge: async (id: string) =>
        id === CODE
          ? {
              id,
              ownerUserId: "owner",
              channelId: "ch",
              agentId: "bot",
              threadId: "canonical",
              transport: "telegram",
              address: null,
            }
          : null,
      consumeChallenge: async () => true,
      bind: async (input) => {
        calls.push({ bind: input });
        return { ...bound, ...input };
      },
      updateSmsStatus: async () => {},
      findBinding: async (transport, realm, identity) =>
        options.bound !== false &&
        transport === "telegram" &&
        realm === "bot123456" &&
        identity === "42"
          ? bound
          : null,
      removeBinding: async (...input) => {
        calls.push({ remove: input });
      },
      botIdentity: async (agentId) => ({ agentId, name: "Bid Desk" }),
    },
    scopeFor: async (ownerUserId, channelId, agentId) =>
      ownerUserId === "owner"
        ? { ownerUserId, channelId, agentId, threadId: "canonical" }
        : null,
    telegram,
    productName: "Magpie CRM",
    approvals: {
      store: {
        get: async (owner, id) => {
          if (owner !== "owner" || id !== APPROVAL)
            throw new Error("not found");
          return {
            status: "pending",
            action: {
              botId: "bot",
              toolRef: "crm/track_bid",
              effect: "write",
              threadId: "canonical",
              args: {},
            },
          };
        },
      },
      decide: async (...input) => {
        calls.push({ decide: input });
        return {};
      },
      answerQuestion: async (...input) => {
        calls.push({ answer: input });
        return {};
      },
      inbox: async () => ({
        questions: options.question
          ? [{ id: "q1", threadId: "canonical", question: "Which bid?" }]
          : [],
      }),
    },
  });
  const post = (update: unknown, secret = SECRET) =>
    routes.request("/telegram", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": secret,
      },
      body: JSON.stringify(update),
    });
  const message = (text: string, chat = { id: 42, type: "private" }) => ({
    update_id: 9,
    message: { message_id: 7, from: { id: 42 }, chat, text },
  });
  const said = () =>
    sent
      .filter((call) => call.method === "sendMessage")
      .map((call) => call.body.text);
  return { post, message, sent, said, calls, telegram };
}

test("a request without the webhook secret is refused before anything runs", async () => {
  const f = fixture();
  const response = await f.post(f.message("hello"), "wrong");
  expect(response.status).toBe(401);
  expect(f.calls).toEqual([]);
  expect(f.sent).toEqual([]);
});

test("the /start link binds this chat to the code's own Bot and conversation", async () => {
  const f = fixture({ bound: false });
  const response = await f.post(f.message(`/start ${CODE}`));
  expect(response.status).toBe(200);
  expect(f.calls).toEqual([
    {
      bind: {
        ownerUserId: "owner",
        channelId: "ch",
        agentId: "bot",
        threadId: "canonical",
        transport: "telegram",
        realm: "bot123456",
        identity: "42",
        address: "42",
      },
    },
  ]);
  expect(f.said()[0]).toStartWith(
    "Connected. Messages you send here now go to Bid Desk",
  );
});

test("an expired or foreign link code binds nothing", async () => {
  const f = fixture({ bound: false });
  await f.post(f.message("/start 99999999-2222-4333-8444-555555555555"));
  await f.post(f.message("/start not-a-code"));
  expect(f.calls).toEqual([]);
  expect(f.said()[0]).toStartWith("That link expired or was already used.");
});

test("someone who never linked gets instructions, never a turn", async () => {
  const f = fixture({ bound: false });
  await f.post(f.message("find me bids"));
  expect(f.calls).toEqual([]);
  expect(f.said()).toEqual([
    "To talk to a Bot here, open Magpie CRM, go to the Bot's page, and choose Connect Telegram under Reaching you.",
  ]);
});

test("a linked person's message is queued for their Bot, once per Telegram message", async () => {
  const f = fixture();
  await f.post(f.message("find me bids"));
  expect(f.calls).toEqual([
    {
      receive: {
        source: "telegram",
        realm: "bot123456",
        identity: "42",
        address: "42",
        externalId: "42:7",
        text: "find me bids",
      },
    },
  ]);
  expect(f.sent.map((call) => call.method)).toEqual(["sendChatAction"]);
});

test("a reply while the Bot is waiting on a question answers that question", async () => {
  const f = fixture({ question: true });
  await f.post(f.message("The FBI one"));
  expect(f.calls).toEqual([{ answer: ["owner", "q1", "The FBI one"] }]);
  expect(f.said()).toEqual(["Thanks. I passed your answer to Bid Desk."]);
});

test("group chats are ignored", async () => {
  const f = fixture();
  await f.post(f.message("hello", { id: -100, type: "group" }));
  expect(f.calls).toEqual([]);
  expect(f.sent).toEqual([]);
});

test("/stop disconnects this chat from the Bot", async () => {
  const f = fixture();
  await f.post(f.message("/stop"));
  expect(f.calls).toEqual([{ remove: ["owner", "b1"] }]);
  expect(f.said()[0]).toStartWith("Disconnected.");
});

test("an approval button decides as the linked owner and clears the buttons", async () => {
  const f = fixture();
  await f.post({
    update_id: 10,
    callback_query: {
      id: "cb1",
      from: { id: 42 },
      data: `ap:${APPROVAL}:once`,
      message: { message_id: 5, chat: { id: 42, type: "private" } },
    },
  });
  expect(f.calls).toEqual([{ decide: ["owner", APPROVAL, "allow_once"] }]);
  expect(f.sent.map((call) => call.method)).toEqual([
    "editMessageReplyMarkup",
    "answerCallbackQuery",
  ]);
  expect(f.sent[1]?.body.text).toBe("Allowed once. Bid Desk is continuing.");
});

test("an approval button from someone not linked decides nothing", async () => {
  const f = fixture({ bound: false });
  await f.post({
    update_id: 11,
    callback_query: {
      id: "cb2",
      from: { id: 99 },
      data: `ap:${APPROVAL}:deny`,
    },
  });
  expect(f.calls).toEqual([]);
  expect(f.sent[0]?.body.text).toBe(
    "This chat isn't connected, so nothing was decided.",
  );
});

test("an approval request is sent with Allow once, Deny and Review buttons; long replies are split", async () => {
  const f = fixture();
  await f.telegram.send({
    id: "o1",
    address: "42",
    text: "Bid Desk asks for approval to use crm/track_bid.",
    kind: "approval",
    requestId: APPROVAL,
  });
  expect(f.sent[0]?.body.reply_markup).toEqual({
    inline_keyboard: [
      [
        { text: "Allow once", callback_data: `ap:${APPROVAL}:once` },
        { text: "Deny", callback_data: `ap:${APPROVAL}:deny` },
      ],
      [{ text: "Review", url: "https://o.test/tasks" }],
    ],
  });
  await f.telegram.send({ id: "o2", address: "42", text: "x".repeat(5000) });
  const parts = f.sent.slice(1).map((call) => String(call.body.text).length);
  expect(parts).toEqual([4096, 904]);
});

test("Telegram is configured from the bot token, with a derived webhook secret", () => {
  const providers = configuredDeliveryProviders("https://o.test", {
    TELEGRAM_BOT_TOKEN: TOKEN,
  });
  expect(providers.telegram?.config.webhookUrl).toBe(
    "https://o.test/api/delivery/webhooks/telegram",
  );
  expect(providers.telegram?.config.secret).toMatch(/^[0-9a-f]{64}$/);
  expect(() =>
    configuredDeliveryProviders("https://o.test", {
      TELEGRAM_BOT_TOKEN: "not a token",
    }),
  ).toThrow("TELEGRAM_BOT_TOKEN");
});
