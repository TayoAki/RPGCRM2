import { Hono } from "hono";
import type { AppVariables } from "../auth/guards";
import type { CrmMail } from "./mail";
import { type CrmRecords, CrmRefusal } from "./records";

type Variables = { Variables: AppVariables };

/**
 * Mailboxes and sending, under /api/crm/mail. Anyone signed in connects their own mailbox and sends
 * from it; the shared one, used by everybody without their own, is an admin's to set.
 */
export function createMailRoutes(deps: { mail: CrmMail; records: CrmRecords }) {
  const { mail, records } = deps;
  const routes = new Hono<Variables>();

  const ownerOf = async (
    actor: AppVariables["actor"],
    scope: string,
  ): Promise<number | null> => {
    if (scope === "mine") return (await records.sale(actor)).id;
    if (scope !== "shared") throw new CrmRefusal("Not found.", 404);
    if (actor.role !== "admin") {
      throw new CrmRefusal("Only an admin can change this.", 403);
    }
    return null;
  };

  routes.get("/mailboxes", async (context) =>
    context.json({
      data: await mail.mailboxesFor((await records.sale(context.var.actor)).id),
    }),
  );

  routes.put("/mailboxes/:scope", async (context) => {
    const owner = await ownerOf(context.var.actor, context.req.param("scope"));
    const body = await context.req.json().catch(() => null);
    return context.json({ data: await mail.saveMailbox(owner, body) });
  });

  routes.delete("/mailboxes/:scope", async (context) => {
    await mail.removeMailbox(
      await ownerOf(context.var.actor, context.req.param("scope")),
    );
    return context.json({ data: null });
  });

  routes.post("/mailboxes/:scope/test", async (context) => {
    const owner = await ownerOf(context.var.actor, context.req.param("scope"));
    const problem = await mail.testMailbox(owner);
    return context.json({ data: { ok: problem === null, problem } });
  });

  routes.post("/emails", async (context) => {
    const sale = await records.sale(context.var.actor);
    const body = await context.req.json().catch(() => null);
    return context.json({ data: await mail.compose(sale.id, body) }, 201);
  });

  // Somebody's own email, or any email for an admin.
  const ownEmail = async (actor: AppVariables["actor"], raw: string) => {
    const id = Number(raw);
    const email = Number.isSafeInteger(id)
      ? await records.get("emails", id)
      : undefined;
    if (!email) throw new CrmRefusal("Not found.", 404);
    if (
      actor.role !== "admin" &&
      email.sales_id !== (await records.sale(actor)).id
    ) {
      throw new CrmRefusal("That's someone else's email.", 403);
    }
    return id;
  };

  routes.post("/emails/:id/send", async (context) =>
    context.json({
      data: await mail.send(
        await ownEmail(context.var.actor, context.req.param("id")),
      ),
    }),
  );

  routes.delete("/emails/:id", async (context) => {
    await mail.cancel(
      await ownEmail(context.var.actor, context.req.param("id")),
    );
    return context.json({ data: null });
  });

  return routes;
}
