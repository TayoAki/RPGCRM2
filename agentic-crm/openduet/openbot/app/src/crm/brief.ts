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

/** Who a mail's sender is in the CRM, when the server found them. */
export const crmSenderSchema = z
  .object({
    contactId: z.number(),
    name: z.string(),
    company: z.string().nullable(),
  })
  .optional()
  .catch(undefined);

type CrmSender = NonNullable<z.infer<typeof crmSenderSchema>>;

export const crmSenderNote = (sender: CrmSender) =>
  sender.company ? `In the CRM, at ${sender.company}` : "In the CRM";

/** Added to Start, so the Bot can log the email on the contact or update them. */
export const crmSenderSentence = (sender: CrmSender) =>
  ` ${sender.name} is contact ${sender.contactId} in the CRM.`;
