import { useRecordContext } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type { Contact, Deal } from "../components/atomic-crm/types";
import { EmailsSection } from "./mail/EmailsSection";
import { MeetingsSection } from "./meetings/MeetingsSection";
import { ProposalsSection } from "./proposals/ProposalsSection";

const emailOf = (contact: Contact | undefined) =>
  contact?.email_jsonb?.[0]?.email ?? "";

/** Meetings and email under a contact's notes. */
export const ContactExtras = () => {
  const contact = useRecordContext<Contact>();
  if (!contact) return null;
  return (
    <Card className="mt-4">
      <CardContent className="space-y-6">
        <MeetingsSection
          filter={{ contact_id: contact.id }}
          links={{
            contact_id: contact.id,
            company_id: contact.company_id ?? null,
          }}
        />
        <Separator />
        <EmailsSection
          filter={{ contact_id: contact.id }}
          draft={{ to: emailOf(contact), contact_id: contact.id }}
        />
      </CardContent>
    </Card>
  );
};

/** Proposals, meetings and email on a deal, above its notes. */
export const DealExtras = () => {
  const deal = useRecordContext<Deal & { lead_source?: string | null }>();
  if (!deal) return null;
  const contactId = deal.contact_ids?.[0] ?? null;
  return (
    <div className="m-4 space-y-6">
      {deal.lead_source ? (
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground tracking-wide">
            Lead source
          </span>
          <span className="text-sm">{deal.lead_source}</span>
        </div>
      ) : null}
      <Separator />
      <ProposalsSection dealId={deal.id} />
      <Separator />
      <MeetingsSection
        filter={{ deal_id: deal.id }}
        links={{
          deal_id: deal.id,
          contact_id: contactId,
          company_id: deal.company_id ?? null,
        }}
      />
      <Separator />
      <EmailsSection
        filter={{ deal_id: deal.id }}
        draft={{ to: "", deal_id: deal.id, contact_id: contactId }}
      />
    </div>
  );
};
