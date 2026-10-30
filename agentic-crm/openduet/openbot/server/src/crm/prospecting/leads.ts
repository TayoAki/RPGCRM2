import { z } from "zod";

export const LEAD_SOURCE = "Magpie prospecting";

// How well a lead fits the ideal customer profile, best first.
export const TIERS = ["A", "B", "C", "D"] as const;
export type Tier = (typeof TIERS)[number];
export const tierTag = (tier: Tier) => `ICP tier ${tier}`;

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : undefined));

export const leadSchema = z.object({
  company: z.object({
    name: z.string().trim().min(1).max(200),
    website: optionalText,
    sector: optionalText,
    size: z.number().int().positive().max(1_000_000).optional(),
    city: optionalText,
    country: optionalText,
    description: optionalText,
  }),
  contact: z
    .object({
      first_name: z.string().trim().min(1).max(100),
      last_name: z.string().trim().max(100).default(""),
      title: optionalText,
      email: z.string().trim().email().max(320).optional(),
      // Only an address a verifier called valid counts as verified.
      email_verified: z.boolean().default(false),
      linkedin_url: optionalText,
    })
    .optional(),
  // Why this company fits the profile, in one or two sentences a person can check.
  reason: z.string().trim().min(1).max(1000),
  signals: z.array(z.string().trim().max(200)).max(10).default([]),
  tier: z.enum(TIERS).optional(),
  score: z.number().int().min(0).max(100).optional(),
  // Where the lead came from, such as the LinkedIn post they commented on.
  source_url: optionalText,
});

export const leadListSchema = z.object({
  name: z.string().trim().min(1).max(80),
  leads: z.array(leadSchema).min(1).max(50),
});

export type Lead = z.infer<typeof leadSchema>;
export type LeadList = z.infer<typeof leadListSchema>;

/** A website or email's domain, lower-case and without `www.`, or null. */
export function domainOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  const host = text.includes("@")
    ? text.split("@").pop()
    : (() => {
        try {
          return new URL(text.includes("://") ? text : `https://${text}`)
            .hostname;
        } catch {
          return null;
        }
      })();
  return host ? host.replace(/^www\./, "") || null : null;
}

const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|co|corp|company|gmbh)\b/g, "")
    .trim();

export type Existing = {
  companies: { id: number; name: string; website: string | null }[];
  emails: string[];
};

export type LeadPlan = {
  lead: Lead;
  // An existing company to attach the contact to, or null to create the company.
  companyId: number | null;
  createContact: boolean;
  skipped: string | null;
};

/**
 * What adding each lead would do: reuse a company already in the CRM (same domain or name), skip a
 * contact whose email is already there, and skip a lead repeated within the list.
 */
export function planLeads(leads: Lead[], existing: Existing): LeadPlan[] {
  const byDomain = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const company of existing.companies) {
    const domain = domainOf(company.website);
    if (domain) byDomain.set(domain, company.id);
    byName.set(nameKey(company.name), company.id);
  }
  const emails = new Set(existing.emails.map((email) => email.toLowerCase()));
  const seen = new Set<string>();
  return leads.map((lead) => {
    const domain = domainOf(lead.company.website);
    const key = domain ?? nameKey(lead.company.name);
    const companyId =
      (domain ? byDomain.get(domain) : undefined) ??
      byName.get(nameKey(lead.company.name)) ??
      null;
    const email = lead.contact?.email?.toLowerCase();
    if (seen.has(`${key}|${email ?? lead.contact?.first_name ?? ""}`)) {
      return { lead, companyId, createContact: false, skipped: "Listed twice" };
    }
    seen.add(`${key}|${email ?? lead.contact?.first_name ?? ""}`);
    if (email && emails.has(email)) {
      return {
        lead,
        companyId,
        createContact: false,
        skipped: "Already in the CRM",
      };
    }
    if (companyId !== null && !lead.contact) {
      return {
        lead,
        companyId,
        createContact: false,
        skipped: "Company already in the CRM",
      };
    }
    return { lead, companyId, createContact: !!lead.contact, skipped: null };
  });
}
