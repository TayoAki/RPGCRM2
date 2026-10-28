import { APIError } from "better-auth/api";
import { Hono, type MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { type AuditStore, recordAuditEvent } from "../audit";
import { type PasswordPeople, setPasswordPath } from "../auth/email-password";
import { type AppVariables, requireAdmin } from "../auth/guards";
import type { PeopleStore } from "./store";

type Variables = { Variables: AppVariables };

const newPerson = z.object({
  email: z.email().max(320),
  name: z.string().trim().min(1).max(200),
});

/**
 * People an administrator adds for email and password sign-in, and the links that let them set a
 * password. Mounted at /api/admin/people beside the role and access routes.
 */
export function createPasswordPeopleRoutes(deps: {
  requireUser: MiddlewareHandler<Variables>;
  passwordPeople: PasswordPeople;
  peopleStore: PeopleStore;
  auditStore?: AuditStore;
}) {
  const routes = new Hono<Variables>();

  const record = async (
    actorUserId: string,
    eventType: "person.added" | "person.password_link_issued",
    person: { id: string; email: string },
  ) => {
    if (!deps.auditStore) return;
    await recordAuditEvent(deps.auditStore, {
      eventType,
      targetType: "person",
      targetId: person.id,
      actorUserId,
      payload: { email: person.email },
    });
  };

  routes.post("/", deps.requireUser, async (context) => {
    const denied = requireAdmin(context);
    if (denied) return denied;

    const parsed = newPerson.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return context.json(
        { error: "A name and an email address are required." },
        400,
      );
    }
    const email = parsed.data.email.toLowerCase();

    try {
      const { userId, token } = await deps.passwordPeople.add({
        email,
        name: parsed.data.name,
      });
      await record(context.var.actor.id, "person.added", { id: userId, email });
      return context.json(
        {
          person: await deps.peopleStore.find(userId),
          setPasswordPath: setPasswordPath(token),
        },
        201,
      );
    } catch (error) {
      return refusal(context, error);
    }
  });

  routes.post("/:userId/password-link", deps.requireUser, async (context) => {
    const denied = requireAdmin(context);
    if (denied) return denied;

    const person = await deps.peopleStore.find(context.req.param("userId"));
    if (!person) {
      return context.json({ error: "That person is not here." }, 404);
    }
    // A link sets a password, so it would let whoever holds it take over an account that signs in
    // through an identity provider. Those people reset their access there instead.
    if (person.providers.some((provider) => provider !== "credential")) {
      return context.json(
        {
          error:
            "This person signs in through an identity provider, so a password link can't be made for them.",
        },
        409,
      );
    }
    if (person.revoked) {
      return context.json(
        { error: "This person's access is removed. Restore it first." },
        409,
      );
    }

    const token = await deps.passwordPeople.issueLink(person.email);
    await record(context.var.actor.id, "person.password_link_issued", person);
    return context.json({ setPasswordPath: setPasswordPath(token) });
  });

  return routes;
}

function refusal(
  context: { json: (body: unknown, status: ContentfulStatusCode) => Response },
  error: unknown,
) {
  if (error instanceof APIError) {
    return context.json(
      { error: error.body?.message ?? error.message },
      error.statusCode as ContentfulStatusCode,
    );
  }
  throw error;
}
