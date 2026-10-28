import { z } from "zod";
import type { BriefItem } from "@/components/duet/morning-brief-card";

/**
 * The CRM rows the server adds to the morning brief (server/src/crm/brief.ts). Anything unexpected
 * drops the CRM rows rather than the whole brief.
 */
export const crmFollowUpsSchema = z
  .array(
    z.object({
      id: z.string(),
      title: z.string(),
      why: z.string(),
      // Only ever a CRM page, so a row can't be turned into a link elsewhere.
      href: z.string().regex(/^\/crm\/[\w/-]+$/),
    }),
  )
  .catch([]);

export const crmFollowUpRows = (
  items: z.infer<typeof crmFollowUpsSchema>,
): BriefItem[] =>
  items.map(({ id, title, why, href }) => ({ id, title, why, href }));
