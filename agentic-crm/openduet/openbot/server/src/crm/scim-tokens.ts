import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SCIMAuthenticationOptions, SCIMScope } from "@better-auth/scim";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import type { Database } from "../db/client";
import { scimTokens } from "./schema";

const TOKEN = /^mgs_([a-z0-9]{10})_([a-z0-9]{40})$/;
const USED_EVERY_MS = 60_000;
const SCOPES: SCIMScope[] = [
  "scim.users.read",
  "scim.users.write",
  "scim.groups.read",
  "scim.groups.write",
];

const hashOf = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const random = (bytes: number, length: number) =>
  randomBytes(bytes).toString("hex").slice(0, length);

const visible = {
  id: scimTokens.id,
  prefix: scimTokens.prefix,
  created_by: scimTokens.created_by,
  last_used_at: scimTokens.last_used_at,
  created_at: scimTokens.created_at,
};

/** A new token for the directory: returned once, and only its hash is kept. */
export async function createScimToken(database: Database, createdBy: string) {
  const prefix = random(5, 10);
  const token = `mgs_${prefix}_${random(20, 40)}`;
  const [row] = await database
    .insert(scimTokens)
    .values({ prefix, hash: hashOf(token), created_by: createdBy })
    .returning(visible);
  return { token, row };
}

export function listScimTokens(database: Database) {
  return database
    .select(visible)
    .from(scimTokens)
    .where(isNull(scimTokens.revoked_at))
    .orderBy(desc(scimTokens.id));
}

export async function revokeScimToken(database: Database, id: number) {
  const [row] = await database
    .update(scimTokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(and(eq(scimTokens.id, id), isNull(scimTokens.revoked_at)))
    .returning(visible);
  return row;
}

export async function hasScimToken(database: Database) {
  const [row] = await database
    .select({ id: scimTokens.id })
    .from(scimTokens)
    .where(isNull(scimTokens.revoked_at))
    .limit(1);
  return Boolean(row);
}

/** Lets SCIM accept the tokens made in the CRM's settings, for the given connection. */
export function scimTokenAuthentication(
  database: Database,
  connectionId: string,
): SCIMAuthenticationOptions {
  return {
    verifyBearerToken: async ({ token }) => {
      const match = TOKEN.exec(token);
      if (!match) return null;
      const [row] = await database
        .select({ id: scimTokens.id, hash: scimTokens.hash })
        .from(scimTokens)
        .where(
          and(eq(scimTokens.prefix, match[1]), isNull(scimTokens.revoked_at)),
        );
      if (!row) return null;
      const expected = Buffer.from(row.hash, "hex");
      const given = Buffer.from(hashOf(token), "hex");
      if (
        expected.length !== given.length ||
        !timingSafeEqual(expected, given)
      ) {
        return null;
      }
      const now = new Date();
      await database
        .update(scimTokens)
        .set({ last_used_at: now.toISOString() })
        .where(
          and(
            eq(scimTokens.id, row.id),
            or(
              isNull(scimTokens.last_used_at),
              lt(
                scimTokens.last_used_at,
                new Date(now.getTime() - USED_EVERY_MS).toISOString(),
              ),
            ),
          ),
        );
      return { connectionId, credentialId: `crm-${row.id}`, scopes: SCOPES };
    },
  };
}
