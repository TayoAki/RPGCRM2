import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "../auth/guards";
import type { Database } from "../db/client";
import { saleFor } from "./sales";
import { roles } from "./schema";

/** How far a right reaches: no records, the person's own (sales_id), or all of them. */
export type Reach = "none" | "own" | "all";
export type FieldRule = "hidden" | "read_only";

const reach = z.enum(["none", "own", "all"]);

export const roleRules = z.object({
  objects: z
    .record(
      z.string(),
      z.object({
        read: reach.optional(),
        create: z.boolean().optional(),
        update: reach.optional(),
        delete: reach.optional(),
      }),
    )
    .default({}),
  fields: z
    .record(z.string(), z.record(z.string(), z.enum(["hidden", "read_only"])))
    .default({}),
});
export type RoleRules = z.infer<typeof roleRules>;

/**
 * Which object's rules a resource follows. Notes, emails and a deal's stages follow their parent:
 * a role that can't see contacts can't read their notes or mail either.
 */
const RULES_OF: Record<string, string> = {
  contacts_summary: "contacts",
  contact_notes: "contacts",
  emails: "contacts",
  companies_summary: "companies",
  deal_notes: "deals",
  deal_stage_history: "deals",
};

export const rulesObject = (resource: string) => RULES_OF[resource] ?? resource;

export type Access = {
  // An admin, an automation, or a person with no role: nothing is restricted.
  full: boolean;
  salesId: number | null;
  reach: (object: string, action: "read" | "update" | "delete") => Reach;
  canCreate: (object: string) => boolean;
  rule: (object: string, field: string) => FieldRule | undefined;
  hidden: (object: string) => string[];
};

const FULL: Omit<Access, "salesId"> = {
  full: true,
  reach: () => "all",
  canCreate: () => true,
  rule: () => undefined,
  hidden: () => [],
};

export function accessFrom(rules: RoleRules, salesId: number): Access {
  return {
    full: false,
    salesId,
    reach: (object, action) =>
      rules.objects[rulesObject(object)]?.[action] ?? "all",
    canCreate: (object) => rules.objects[rulesObject(object)]?.create ?? true,
    rule: (object, field) => rules.fields[rulesObject(object)]?.[field],
    hidden: (object) =>
      Object.entries(rules.fields[rulesObject(object)] ?? {})
        .filter(([, rule]) => rule === "hidden")
        .map(([field]) => field),
  };
}

/** What a person may do in the CRM: their role's rules, or everything for an admin. */
export async function accessOf(
  database: Database,
  actor: AuthenticatedActor,
): Promise<Access> {
  const sale = await saleFor(database, actor);
  if (actor.role === "admin" || sale.role_id === null) {
    return { ...FULL, salesId: sale.id };
  }
  const [role] = await database
    .select()
    .from(roles)
    .where(eq(roles.id, sale.role_id));
  if (!role) return { ...FULL, salesId: sale.id };
  return accessFrom(roleRules.parse(role.rules ?? {}), sale.id);
}

export const fullAccess = (salesId: number | null): Access => ({
  ...FULL,
  salesId,
});
