import { expect, spyOn, test } from "bun:test";
import { HeadlessToolSuspension } from "@openbot/toolkit/headless-tools";
import { z } from "zod";
import { currentApprovalContext } from "../src/approvals/types";
import { buildAgents } from "../src/copilot";

const realFetch = globalThis.fetch;

// Streamed over a real socket on purpose: a body handed over in one piece hides the lost context.
function streamed(events: unknown[]) {
  const chunks = [
    ...events.map((event) => `data: ${JSON.stringify(event)}\n\n`),
    "data: [DONE]\n\n",
  ];
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(
        new ReadableStream({
          async start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(new TextEncoder().encode(chunk));
              await Bun.sleep(10);
            }
            controller.close();
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  });
  return realFetch(`http://127.0.0.1:${server.port}/`).finally(() =>
    setTimeout(() => server.stop(), 1_000),
  );
}

const CALL = [
  {
    type: "response.created",
    response: { id: "r1", created_at: 1, model: "m" },
  },
  {
    type: "response.output_item.added",
    output_index: 0,
    item: {
      type: "function_call",
      id: "fc1",
      call_id: "call-1",
      name: "save_brief",
      arguments: "",
    },
  },
  {
    type: "response.function_call_arguments.delta",
    item_id: "fc1",
    output_index: 0,
    delta: '{"brief":"x"}',
  },
  {
    type: "response.output_item.done",
    output_index: 0,
    item: {
      type: "function_call",
      id: "fc1",
      call_id: "call-1",
      name: "save_brief",
      arguments: '{"brief":"x"}',
      status: "completed",
    },
  },
  {
    type: "response.completed",
    response: {
      id: "r1",
      created_at: 1,
      model: "m",
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  },
];

test("a tool the model calls mid-stream keeps its run's approval context and can wait for a person", async () => {
  const transport = spyOn(globalThis, "fetch").mockImplementation(() =>
    streamed(CALL),
  );
  const captured: unknown[] = [];
  const events: { type: string; name?: string }[] = [];
  try {
    const agents = await buildAgents(
      [{ id: "bot", name: "Bot", type: "built_in", systemPrompt: "Save it." }],
      { provider: "openai", defaultModel: "m" },
      "sk-test",
      undefined,
      async () => [
        {
          name: "save_brief",
          ref: "crm/save_brief",
          description: "Save the brief",
          parameters: z.object({ brief: z.string() }),
          initiator: { kind: "routine", id: "routine" },
          execute: async () => {
            const context = currentApprovalContext();
            captured.push(context);
            throw new HeadlessToolSuspension("Waiting for approval", {
              kind: "approval",
              approvalId: "approval",
              requestId: "approval",
              continuation: context,
            });
          },
        },
      ],
    );
    const agent = agents.bot;
    if (!agent) throw new Error("missing agent");
    agent.threadId = "thread";
    agent.setMessages([{ id: "request", role: "user", content: "Save it" }]);
    await agent.runAgent(
      { runId: "run" },
      { onEvent: ({ event }) => void events.push(event as never) },
    );
  } finally {
    transport.mockRestore();
  }
  expect(captured[0]).toMatchObject({
    runId: "run",
    threadId: "thread",
    toolCallId: "call-1",
    toolName: "save_brief",
  });
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "CUSTOM",
      name: "openbot.headless.waiting",
    }),
  );
  expect(events).not.toContainEqual(
    expect.objectContaining({ type: "TOOL_CALL_RESULT" }),
  );
});
