import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { configuration } from "../schema";

/*
 * What prospecting keeps between runs, in the CRM's one configuration row: the saved customer
 * profile and this month's spend on lookups. The spend is added in one statement, so two lookups
 * finishing together both count.
 */

export type ProspectingConfig = {
  tregApiKey: string | undefined;
  monthlyBudgetUsd: number;
};

export const monthOf = (now: Date) => now.toISOString().slice(0, 7);

export async function ensureRow(database: Database) {
  await database
    .insert(configuration)
    .values({ id: 1, config: {} })
    .onConflictDoNothing();
}

export async function readConfig(
  database: Database,
): Promise<Record<string, unknown>> {
  const [row] = await database
    .select({ config: configuration.config })
    .from(configuration)
    .where(eq(configuration.id, 1));
  const config = row?.config;
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

/** This month's spend on lookups, in micro-dollars. */
export async function spentThisMonth(
  database: Database,
  now: Date = new Date(),
  ledger = "prospecting_spend",
): Promise<number> {
  const spend = (await readConfig(database))[ledger] as
    | { month?: string; micro?: number }
    | undefined;
  return spend?.month === monthOf(now) ? Number(spend.micro) || 0 : 0;
}

export async function addSpend(
  database: Database,
  micro: number,
  now: Date = new Date(),
  ledger = "prospecting_spend",
): Promise<void> {
  if (!(micro > 0)) return;
  await ensureRow(database);
  const month = monthOf(now);
  await database.execute(sql`
    update crm.configuration
    set config = jsonb_set(
      coalesce(config, '{}'::jsonb),
      ${`{${ledger}}`}::text[],
      jsonb_build_object(
        'month', ${month}::text,
        'micro', (case when config->${ledger}::text->>'month' = ${month}::text
          then coalesce((config->${ledger}::text->>'micro')::bigint, 0) else 0 end) + ${Math.round(micro)}::bigint
      )
    )
    where id = 1`);
}

async function readText(database: Database, key: string) {
  const value = (await readConfig(database))[key];
  return typeof value === "string" && value.trim() ? value : null;
}

async function saveText(database: Database, key: string, value: string) {
  await ensureRow(database);
  await database.execute(sql`
    update crm.configuration
    set config = jsonb_set(coalesce(config, '{}'::jsonb), ${`{${key}}`}::text[], to_jsonb(${value}::text))
    where id = 1`);
}

/** The sender's business name and postal address, which every outreach email ends with. */
export const outreachFooter = (database: Database) =>
  readText(database, "outreach_footer");

export const saveOutreachFooter = (database: Database, footer: string) =>
  saveText(database, "outreach_footer", footer);

export const savedProfile = (database: Database) =>
  readText(database, "prospecting_profile");

export const saveProfile = (database: Database, profile: string) =>
  saveText(database, "prospecting_profile", profile);
