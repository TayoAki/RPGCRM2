import type { Hono, MiddlewareHandler } from "hono";
import type { AuditStore } from "./audit";
import type { PasswordPeople } from "./auth/email-password";
import type { AppVariables } from "./auth/guards";
import { createProspectingRoutes } from "./crm/prospecting/routes";
import { createPublicApi } from "./crm/public-api";
import { createCrmRoutes } from "./crm/routes";
import type { CrmServices } from "./crm/services";
import { createCrmPublicRoutes } from "./crm/workflows/routes";
import { createWorkspaceSetupRoutes } from "./crm/workspace-setup";
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
  crm?: CrmServices;
  prospecting?: Omit<
    Parameters<typeof createProspectingRoutes>[0],
    "requireUser" | "database" | "records"
  >;
}) {
  return (
    requireUser: MiddlewareHandler<Variables>,
  ): [string, Hono<Variables>][] => [
    [
      "/api/crm",
      createCrmRoutes({
        requireUser,
        database: deps.database,
        ...(deps.crm
          ? {
              mail: deps.crm.mail,
              automation: deps.crm.automation,
              records: deps.crm.records,
            }
          : {}),
      }),
    ],
    ...(deps.crm
      ? ([
          ["/api/crm-public", createCrmPublicRoutes(deps.crm.automation)],
          ["/api/v1", createPublicApi(deps.crm)],
        ] as [string, Hono<Variables>][])
      : []),
    ...(deps.crm && deps.prospecting
      ? ([
          [
            "/api/prospecting",
            createProspectingRoutes({
              requireUser,
              database: deps.database,
              records: deps.crm.records,
              ...deps.prospecting,
            }),
          ],
        ] as [string, Hono<Variables>][])
      : []),
    ...(deps.passwordPeople
      ? ([
          [
            "/api/workspace",
            createWorkspaceSetupRoutes({
              database: deps.database,
              passwordPeople: deps.passwordPeople,
            }),
          ],
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
