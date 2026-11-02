import { sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { ensureRow, readConfig } from "../prospecting/settings";

/*
 * The company brief: what the business does, who it sells to, its goals and its rules, written once
 * and read by every Bot on every run, alongside each person's own standing instructions.
 */

const KEY = "business_brief";
export const MAX_BRIEF_CHARS = 3000;

export type BusinessBrief = {
  text: string;
  updatedAt: string;
  updatedBy: string | null;
};

export async function readBrief(
  database: Database,
): Promise<BusinessBrief | null> {
  const saved = (await readConfig(database))[KEY] as
    | Partial<BusinessBrief>
    | undefined;
  return typeof saved?.text === "string" && saved.text.trim()
    ? {
        text: saved.text,
        updatedAt: String(saved.updatedAt ?? ""),
        updatedBy: saved.updatedBy ?? null,
      }
    : null;
}

export async function saveBrief(
  database: Database,
  text: string,
  updatedBy: string | null,
  now: Date = new Date(),
): Promise<BusinessBrief> {
  const brief = {
    text: text.trim().slice(0, MAX_BRIEF_CHARS),
    updatedAt: now.toISOString(),
    updatedBy,
  };
  await ensureRow(database);
  await database.execute(sql`
    update crm.configuration
    set config = jsonb_set(coalesce(config, '{}'::jsonb), ${`{${KEY}}`}::text[], ${JSON.stringify(brief)}::text::jsonb)
    where id = 1`);
  return brief;
}

/** A person's standing instructions with the company brief ahead of them, for every run. */
export async function withBusinessBrief(
  database: Database,
  personal: Promise<string | null>,
): Promise<string | null> {
  const [brief, own] = await Promise.all([
    readBrief(database).catch(() => null),
    personal,
  ]);
  if (!brief) return own;
  return [
    `The company brief, which every Bot here works from:\n${brief.text}`,
    own?.trim() ? `This person's own instructions: ${own.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
