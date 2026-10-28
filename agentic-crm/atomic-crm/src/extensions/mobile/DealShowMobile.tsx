import {
  InfiniteListBase,
  ShowBase,
  useGetMany,
  useGetOne,
  useNotify,
  useRecordContext,
  useUpdate,
} from "ra-core";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import MobileHeader from "../../components/atomic-crm/layout/MobileHeader";
import { MobileContent } from "../../components/atomic-crm/layout/MobileContent";
import { NotesIterator } from "../../components/atomic-crm/notes/NotesIterator";
import { useConfigurationContext } from "../../components/atomic-crm/root/ConfigurationContext";
import type { Company, Contact, Deal } from "../../components/atomic-crm/types";
import { DealExtras } from "../RecordExtras";

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm">{children}</span>
  </div>
);

const DealShowMobileContent = () => {
  const deal = useRecordContext<Deal>();
  const { dealStages, currency } = useConfigurationContext();
  const [update] = useUpdate();
  const notify = useNotify();
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: deal?.company_id },
    { enabled: Boolean(deal?.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>("contacts", {
    ids: deal?.contact_ids ?? [],
  });
  if (!deal) return null;
  return (
    <div>
      <MobileHeader>
        <Link
          to="/deals"
          aria-label="All deals"
          className="mr-2 flex items-center"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">{deal.name}</h1>
      </MobileHeader>
      <MobileContent>
        <div className="flex flex-col gap-4">
          <Select
            value={deal.stage}
            onValueChange={(stage) =>
              update(
                "deals",
                { id: deal.id, data: { stage }, previousData: deal },
                {
                  mutationMode: "optimistic",
                  onError: () =>
                    notify("Couldn't change the stage.", { type: "error" }),
                },
              )
            }
          >
            <SelectTrigger aria-label="Stage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dealStages.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Fact label="Amount">
              {deal.amount
                ? new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency,
                    maximumFractionDigits: 0,
                  }).format(deal.amount)
                : "-"}
            </Fact>
            <Fact label="Expected closing">
              {deal.expected_closing_date
                ? new Date(deal.expected_closing_date).toLocaleDateString()
                : "-"}
            </Fact>
            {company ? (
              <Fact label="Company">
                <Link
                  to={`/companies/${company.id}/show`}
                  className="underline"
                >
                  {company.name}
                </Link>
              </Fact>
            ) : null}
            {contacts.length ? (
              <Fact label="Contacts">
                {contacts.map((contact, index) => (
                  <span key={contact.id}>
                    {index ? ", " : ""}
                    <Link
                      to={`/contacts/${contact.id}/show`}
                      className="underline"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </span>
                ))}
              </Fact>
            ) : null}
          </div>
          {deal.description ? (
            <p className="whitespace-pre-line text-sm">{deal.description}</p>
          ) : null}
        </div>
        <div className="-mx-4">
          <DealExtras />
        </div>
        <InfiniteListBase
          resource="deal_notes"
          filter={{ deal_id: deal.id }}
          sort={{ field: "date", order: "DESC" }}
          perPage={25}
          disableSyncWithLocation
          storeKey={false}
        >
          <NotesIterator reference="deals" />
        </InfiniteListBase>
      </MobileContent>
    </div>
  );
};

/** A deal on a phone: its stage to change in one tap, its facts, its proposals, meetings, email and notes. */
export const DealShowMobile = () => (
  <ShowBase>
    <DealShowMobileContent />
  </ShowBase>
);
