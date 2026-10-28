import type { Hono, MiddlewareHandler } from "hono";
import type { AuditStore } from "./audit";
import type { PasswordPeople } from "./auth/email-password";
import type { AppVariables } from "./auth/guards";
import { createCrmRoutes } from "./crm/routes";
import type { Database } from "./db/client";
import { createPasswordPeopleRoutes } from "./people/password-routes";
import type { PeopleStore } from "./people/store";

type Variables = { Variables: AppVariables };

// Routes this product adds to OpenDuet, kept out of app.ts so upstream merges stay small.
export function createExtraRoutes(deps: {
  database: Database;
  passwordPeople?: PasswordPeople;
  peopleStore: PeopleStore;
  auditStore?: AuditStore;
}) {
  return (
    requireUser: MiddlewareHandler<Variables>,
  ): [string, Hono<Variables>][] => [
    ["/api/crm", createCrmRoutes({ requireUser, database: deps.database })],
    ...(deps.passwordPeople
      ? ([
          [
            "/api/admin/people",
            createPasswordPeopleRoutes({
              requireUser,
              passwordPeople: deps.passwordPeople,
              peopleStore: deps.peopleStore,
              ...(deps.auditStore ? { auditStore: deps.auditStore } : {}),
            }),
          ],
        ] as [string, Hono<Variables>][])
      : []),
  ];
}
