import { sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  addSpend,
  ensureRow,
  readConfig,
  spentThisMonth,
} from "../prospecting/settings";
import type { CompanyProfile } from "./kontract-api";

const LEDGER = "govcon_spend";
const PROFILE = "govcon_profile";

export const EMPTY_PROFILE: CompanyProfile = {
  companyName: "",
  uei: "",
  cage: "",
  address: "",
  contactName: "",
  contactTitle: "Owner",
  email: "",
  phone: "",
  website: "",
  capabilities: "",
  defaultMarkupPct: 35,
};

export const govconSpent = (database: Database, now: Date = new Date()) =>
  spentThisMonth(database, now, LEDGER);

export const addGovconSpend = (
  database: Database,
  micro: number,
  now: Date = new Date(),
) => addSpend(database, micro, now, LEDGER);

export async function companyProfile(
  database: Database,
): Promise<CompanyProfile> {
  const saved = (await readConfig(database))[PROFILE];
  return saved && typeof saved === "object" && !Array.isArray(saved)
    ? { ...EMPTY_PROFILE, ...(saved as Partial<CompanyProfile>) }
    : EMPTY_PROFILE;
}

export async function saveCompanyProfile(
  database: Database,
  profile: CompanyProfile,
): Promise<void> {
  await ensureRow(database);
  await database.execute(sql`
    update crm.configuration
    set config = jsonb_set(coalesce(config, '{}'::jsonb), ${`{${PROFILE}}`}::text[], ${JSON.stringify(profile)}::text::jsonb)
    where id = 1`);
}
