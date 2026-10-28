import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppVariables } from "../../auth/guards";
import type { Database } from "../../db/client";
import { bookingToken, readBooking, recordBooking } from "../bookings";
import type { CrmMail } from "../mail";
import type { Proposals } from "../proposals";
import { type CrmRecords, CrmRefusal } from "../records";
import { DATE_FIELDS, sameToken, type WorkflowEngine } from "./engine";
import { DEFAULT_LEAD_SOURCES, DEFAULT_MEETING_OUTCOMES } from "./recipes";
import type { WorkflowStore } from "./store";

type Variables = { Variables: AppVariables };

export type AutomationDeps = {
  database: Database;
  records: CrmRecords;
  mail: CrmMail;
  proposals: Proposals;
  engine: WorkflowEngine;
  workflows: WorkflowStore;
  encryptionKey: string;
  apiUrl: string;
  hasModel: () => Promise<boolean>;
  hasBot: boolean;
};

const PUBLIC_BODY_LIMIT = 256 * 1024;

const idParam = (raw: string) => {
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new CrmRefusal("Not found.", 404);
  return id;
};

const adminOnly = (actor: AppVariables["actor"]) => {
  if (actor.role !== "admin")
    throw new CrmRefusal("Only an admin can change automations.", 403);
};

/** Automations, and proposal actions, under /api/crm. */
export function createAutomationRoutes(deps: AutomationDeps) {
  const { records, workflows, engine, proposals } = deps;
  const routes = new Hono<Variables>();

  const webhookUrl = (row: { id: number; webhook_token: string }) =>
    `${deps.apiUrl}/api/crm-public/hooks/${row.id}/${row.webhook_token}`;

  routes.get("/automation/info", async (context) => {
    const { mine, shared } = await deps.mail.mailboxesFor(
      (await records.sale(context.var.actor)).id,
    );
    const config = ((await records.get(context.var.actor, "configuration", 1))
      ?.config ?? {}) as Record<string, unknown>;
    const listOr = (value: unknown, fallback: string[]) =>
      Array.isArray(value) && value.length ? value : fallback;
    return context.json({
      data: {
        booking_url:
          context.var.actor.role === "admin"
            ? `${deps.apiUrl}/api/crm-public/bookings/${bookingToken(deps.encryptionKey)}`
            : null,
        date_fields: DATE_FIELDS,
        meeting_outcomes: listOr(
          config.meetingOutcomes,
          DEFAULT_MEETING_OUTCOMES,
        ),
        lead_sources: listOr(config.leadSources, DEFAULT_LEAD_SOURCES),
        ready: {
          mailbox: Boolean(mine ?? shared),
          model: await deps.hasModel(),
          bot: deps.hasBot,
        },
      },
    });
  });

  routes.get("/automation/workflows", async (context) =>
    context.json({ data: await workflows.list() }),
  );

  routes.post("/automation/workflows", async (context) => {
    adminOnly(context.var.actor);
    const sale = await records.sale(context.var.actor);
    const body = await context.req.json().catch(() => null);
    return context.json({ data: await workflows.create(sale.id, body) }, 201);
  });

  routes.get("/automation/workflows/:id", async (context) => {
    const row = await workflows.get(idParam(context.req.param("id")));
    return context.json({
      data: {
        ...row,
        webhook_url:
          context.var.actor.role === "admin" ? webhookUrl(row) : null,
      },
    });
  });

  routes.put("/automation/workflows/:id", async (context) => {
    adminOnly(context.var.actor);
    const body = await context.req.json().catch(() => null);
    return context.json({
      data: await workflows.update(idParam(context.req.param("id")), body),
    });
  });

  routes.delete("/automation/workflows/:id", async (context) => {
    adminOnly(context.var.actor);
    await workflows.remove(idParam(context.req.param("id")));
    return context.json({ data: null });
  });

  routes.post("/automation/workflows/:id/run", async (context) => {
    const body = (await context.req.json().catch(() => ({}))) as {
      record_id?: unknown;
    };
    const runId = await engine.runManually(
      idParam(context.req.param("id")),
      idParam(String(body.record_id)),
    );
    return context.json({ data: { run_id: runId } }, 201);
  });

  routes.get("/automation/workflows/:id/runs", async (context) =>
    context.json(
      await workflows.runs(
        idParam(context.req.param("id")),
        Number(context.req.query("page") ?? 1) || 1,
      ),
    ),
  );

  routes.get("/automation/runs/:id", async (context) =>
    context.json({
      data: await workflows.run(idParam(context.req.param("id"))),
    }),
  );

  routes.post("/automation/runs/:id/cancel", async (context) => {
    adminOnly(context.var.actor);
    await engine.cancel(idParam(context.req.param("id")));
    return context.json({ data: null });
  });

  routes.post("/actions/deals/:id/proposal", async (context) => {
    const body = (await context.req.json().catch(() => ({}))) as {
      instructions?: unknown;
    };
    const proposal = await proposals.generate(
      context.var.actor,
      idParam(context.req.param("id")),
      typeof body.instructions === "string"
        ? body.instructions.slice(0, 4000)
        : "",
    );
    return context.json({ data: proposal }, 201);
  });

  routes.post("/actions/proposals/:id/send", async (context) => {
    const body = (await context.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const text = (value: unknown) =>
      typeof value === "string" ? value : undefined;
    const email = await proposals.send(
      context.var.actor,
      idParam(context.req.param("id")),
      {
        ...(text(body.subject) ? { subject: text(body.subject) } : {}),
        ...(text(body.body) ? { body: text(body.body) } : {}),
        sendAt: text(body.send_at) ?? null,
      },
    );
    return context.json({ data: email });
  });

  return routes;
}

/**
 * What the outside world calls, with no sign-in: a client's proposal link, booking tools and
 * webhook automations. Each address carries its own secret. Mounted at /api/crm-public.
 */
export function createCrmPublicRoutes(deps: AutomationDeps) {
  const routes = new Hono<Variables>();
  routes.use(
    "*",
    bodyLimit({
      maxSize: PUBLIC_BODY_LIMIT,
      onError: (context) => context.json({ error: "That's too large." }, 413),
    }),
  );
  const notFound = { error: "Not found." };

  routes.get("/proposals/:token", async (context) => {
    const proposal = await deps.proposals.view(context.req.param("token"));
    return proposal
      ? context.json({ data: proposal })
      : context.json(notFound, 404);
  });

  routes.post("/proposals/:token/:answer{accept|decline}", async (context) => {
    const body = (await context.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const result = await deps.proposals.answer(
      context.req.param("token"),
      context.req.param("answer") === "accept" ? "accepted" : "declined",
      {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
      },
    );
    return context.json({ data: result });
  });

  routes.post("/bookings/:token", async (context) => {
    if (
      !sameToken(context.req.param("token"), bookingToken(deps.encryptionKey))
    ) {
      return context.json(notFound, 404);
    }
    const booking = readBooking(await context.req.json().catch(() => null));
    if (!booking) {
      // Booking tools send pings and other events too; saying OK stops them retrying.
      return context.json({ data: { recorded: false } });
    }
    const result = await recordBooking(deps, booking);
    return context.json({ data: { recorded: Boolean(result), ...result } });
  });

  routes.post("/hooks/:id/:token", async (context) => {
    const id = Number(context.req.param("id"));
    const raw = await context.req.text();
    let payload: unknown = raw;
    try {
      payload = JSON.parse(raw);
    } catch {
      const form = new URLSearchParams(raw);
      if ([...form.keys()].length) payload = Object.fromEntries(form);
    }
    const runId = Number.isSafeInteger(id)
      ? await deps.engine.receiveWebhook(
          id,
          context.req.param("token"),
          payload,
        )
      : null;
    return runId
      ? context.json({ data: { run_id: runId } }, 202)
      : context.json(notFound, 404);
  });

  routes.onError((error, context) => {
    if (error instanceof CrmRefusal) {
      return context.json({ error: error.message }, error.status);
    }
    throw error;
  });

  return routes;
}
