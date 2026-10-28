import { eq } from "drizzle-orm";
import type { AuthenticatedActor } from "../auth/guards";
import type { Database } from "../db/client";
import { sales } from "./schema";

export type Sale = typeof sales.$inferSelect;

/**
 * The CRM user ("sale") for somebody signed in to OpenDuet, made on their first visit.
 *
 * OpenDuet decides who is an admin, so the sale's flag follows the person's role every time. This is
 * what Atomic CRM's `handle_new_user` trigger did against Supabase's auth table.
 */
export async function saleFor(
  database: Database,
  actor: AuthenticatedActor,
): Promise<Sale> {
  const administrator = actor.role === "admin";
  const [existing] = await database
    .select()
    .from(sales)
    .where(eq(sales.user_id, actor.id))
    .limit(1);
  if (existing) {
    if (
      existing.administrator === administrator &&
      existing.email === actor.email
    ) {
      return existing;
    }
    const [updated] = await database
      .update(sales)
      .set({ administrator, email: actor.email })
      .where(eq(sales.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [firstName, ...otherNames] = (actor.name?.trim() || actor.email).split(
    /\s+/,
  );
  const [created] = await database
    .insert(sales)
    .values({
      user_id: actor.id,
      email: actor.email,
      first_name: firstName ?? actor.email,
      last_name: otherNames.join(" "),
      administrator,
      ...(actor.image ? { avatar: { src: actor.image } } : {}),
    })
    // Two first requests at once: the second finds the first's row.
    .onConflictDoUpdate({ target: sales.user_id, set: { administrator } })
    .returning();
  if (!created) throw new Error("Could not create the CRM user.");
  return created;
}
