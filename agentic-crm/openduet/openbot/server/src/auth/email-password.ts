import { AsyncLocalStorage } from "node:async_hooks";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
} from "better-auth/api";
import { z } from "zod";
import type { AuditEventInput } from "../audit";

/**
 * Email and password sign-in, for a deployment with no identity provider.
 *
 * Nobody signs themselves up: sign-up is closed, because an unverified address could otherwise claim
 * one named in INITIAL_ADMIN_EMAILS. An administrator adds a person and hands them a one-time link to
 * set their password; there is no mail, so the link goes back to the administrator rather than out.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const SET_PASSWORD_LINK_SECONDS = 3 * 24 * 60 * 60;
export const SET_PASSWORD_PATH = "/set-password";

const linkRequests = new AsyncLocalStorage<{ token?: string }>();

// Better Auth hands a reset token only to `sendResetPassword`.
export async function keepSetPasswordToken({
  token,
}: {
  token: string;
}): Promise<void> {
  const request = linkRequests.getStore();
  if (request) request.token = token;
}

export function setPasswordPath(token: string): string {
  return `${SET_PASSWORD_PATH}?token=${encodeURIComponent(token)}`;
}

export const passwordPeoplePlugin = () =>
  ({
    id: "password-people",
    endpoints: {
      addPasswordPerson: createAuthEndpoint(
        "/password-people/add",
        {
          method: "POST",
          body: z.object({
            email: z.email(),
            name: z.string().trim().min(1).max(200),
          }),
          // Never routed over HTTP; only the server's admin routes call it.
          metadata: { SERVER_ONLY: true },
        },
        async (ctx) => {
          const email = ctx.body.email.toLowerCase();
          if (await ctx.context.internalAdapter.findUserByEmail(email)) {
            throw new APIError("CONFLICT", {
              message: "Somebody with that address is already here.",
            });
          }
          // Runs the same admission checks as any other new account: domains, removals, SSO.
          const user = await ctx.context.internalAdapter.createUser(
            { email, name: ctx.body.name, emailVerified: false },
            { method: "email-password" },
          );
          return ctx.json({ id: user.id });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;

export type PasswordAuthApi = {
  api: {
    addPasswordPerson: (input: {
      body: { email: string; name: string };
    }) => Promise<{ id: string }>;
    requestPasswordReset: (input: {
      body: { email: string };
    }) => Promise<unknown>;
  };
};

export type PasswordPeople = {
  add: (person: {
    email: string;
    name: string;
  }) => Promise<{ userId: string; token: string }>;
  issueLink: (email: string) => Promise<string>;
};

export function createPasswordPeople(auth: PasswordAuthApi): PasswordPeople {
  const issueLink = async (email: string) => {
    const request: { token?: string } = {};
    await linkRequests.run(request, () =>
      auth.api.requestPasswordReset({ body: { email } }),
    );
    if (!request.token) {
      throw new Error("Nobody with that address is here.");
    }
    return request.token;
  };
  return {
    add: async (person) => {
      const { id } = await auth.api.addPasswordPerson({ body: person });
      return { userId: id, token: await issueLink(person.email) };
    },
    issueLink,
  };
}

type SignInVerdict = "allow" | "break_glass" | "refuse";

// Better Auth asks `validateUserInfo` only when an account is created, so a password sign-in to an
// existing account is checked against SSO-required mode here.
export function passwordSignInHooks(input: {
  decide: (email: string | undefined) => Promise<SignInVerdict>;
  record: (event: AuditEventInput) => Promise<void>;
  refusal: string;
}) {
  const emailOf = (body: unknown) => {
    const email = (body as { email?: unknown } | undefined)?.email;
    return typeof email === "string" ? email : undefined;
  };
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = emailOf(ctx.body);
      if ((await input.decide(email)) !== "refuse") return;
      await input.record({
        eventType: "session.refused",
        targetType: "person",
        payload: {
          email,
          provider: "email-password",
          reason: "SSO is required on this deployment",
        },
      });
      throw new APIError("FORBIDDEN", { message: input.refusal });
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email" || !ctx.context.newSession) return;
      const email = emailOf(ctx.body);
      if ((await input.decide(email)) !== "break_glass") return;
      await input.record({
        eventType: "session.break_glass",
        targetType: "person",
        targetId: ctx.context.newSession.user.id,
        actorUserId: ctx.context.newSession.user.id,
        payload: {
          email,
          provider: "email-password",
          reason:
            "SSO is required, and this address is named in INITIAL_ADMIN_EMAILS, so it was let in another way",
        },
      });
    }),
  };
}
