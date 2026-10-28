import { eq, notExists, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { revokedAccess, userRoles, users } from "../db/schema";
import { namesOf } from "./sales";
import { sales } from "./schema";

/** Turning a person off in the company's directory turns off their CRM access and API keys too. */
export async function setDirectoryAccess(
  database: Database,
  userId: string,
  active: boolean,
): Promise<void> {
  await database
    .update(sales)
    .set({ disabled: !active })
    .where(eq(sales.user_id, userId));
}

/** Everyone who can sign in is a CRM user, so people a directory adds can be given records before their first visit. */
export async function addMissingSales(database: Database): Promise<void> {
  const missing = await database
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: userRoles.role,
      revoked: revokedAccess.email,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(
      revokedAccess,
      eq(revokedAccess.email, sql`lower(${users.email})`),
    )
    .where(
      notExists(
        database
          .select({ id: sales.id })
          .from(sales)
          .where(eq(sales.user_id, users.id)),
      ),
    );
  if (!missing.length) return;
  await database
    .insert(sales)
    .values(
      missing.map((person) => ({
        user_id: person.id,
        email: person.email,
        ...namesOf(person.name, person.email),
        administrator: person.role === "admin",
        disabled: person.revoked !== null,
      })),
    )
    .onConflictDoNothing({ target: sales.user_id });
}
