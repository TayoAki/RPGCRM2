/* eslint-disable react-refresh/only-export-components */
import {
  useNotify,
  useRecordContext,
  useResourceContext,
  useUpdate,
} from "ra-core";
import { useMemo } from "react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AsideSection } from "../../components/atomic-crm/misc/AsideSection";
import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { RunAutomationButton } from "../automations/RunAutomationButton";
import {
  CustomFieldInputs,
  CustomFieldsAside,
  HistoryButton,
} from "../objects/CustomFields";
import { useAutomationInfo } from "../queries";

export const LIFECYCLE_STAGES = [
  { id: "lead", name: "Lead" },
  { id: "prospect", name: "Prospect" },
  { id: "client", name: "Client" },
  { id: "former-client", name: "Former client" },
];

export const lifecycleLabel = (stage: unknown) =>
  LIFECYCLE_STAGES.find((each) => each.id === stage)?.name ?? "Lead";

const LeadSourceInput = () => {
  const record = useRecordContext<{ lead_source?: string | null }>();
  const { data: info } = useAutomationInfo();
  const choices = useMemo(() => {
    const names = new Set([...(info?.lead_sources ?? [])]);
    if (record?.lead_source) names.add(record.lead_source);
    return [...names].map((name) => ({ id: name, name }));
  }, [info, record?.lead_source]);
  return (
    <AutocompleteInput
      source="lead_source"
      label="Lead source"
      choices={choices}
      helperText={false}
      onCreate={(name?: string) => ({ id: name ?? "", name: name ?? "" })}
      createLabel="Start typing to add a source"
    />
  );
};

/** Where a contact or company is in the customer lifecycle, where they came from, and custom fields. */
export const CustomerInputs = ({
  withDetail = false,
}: {
  withDetail?: boolean;
}) => {
  const resource = useResourceContext();
  return (
    <div className="flex flex-col gap-8">
      <CustomerBasics withDetail={withDetail} />
      {resource === "contacts" || resource === "companies" ? (
        <CustomFieldInputs resource={resource} />
      ) : null}
    </div>
  );
};

const CustomerBasics = ({ withDetail }: { withDetail: boolean }) => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Customer</h6>
    <SelectInput
      source="lifecycle_stage"
      label="Lifecycle stage"
      choices={LIFECYCLE_STAGES}
      defaultValue="lead"
      helperText={false}
    />
    <LeadSourceInput />
    {withDetail ? (
      <TextInput
        source="lead_source_detail"
        label="Campaign or referrer"
        helperText={false}
      />
    ) : null}
  </div>
);

type CustomerRecord = {
  id: string | number;
  lifecycle_stage?: string;
  lead_source?: string | null;
  lead_source_detail?: string | null;
  updated_at?: string;
};

const LifecycleSelector = ({
  resource,
}: {
  resource: "contacts" | "companies";
}) => {
  const record = useRecordContext<CustomerRecord>();
  const [update] = useUpdate();
  const notify = useNotify();
  if (!record) return null;
  return (
    <Select
      value={record.lifecycle_stage ?? "lead"}
      onValueChange={(stage) =>
        update(
          resource,
          {
            id: record.id,
            data: { lifecycle_stage: stage },
            previousData: record,
          },
          {
            mutationMode: "optimistic",
            onError: (error) =>
              notify(
                error instanceof Error ? error.message : "Couldn't save.",
                {
                  type: "error",
                },
              ),
          },
        )
      }
    >
      <SelectTrigger className="w-full" aria-label="Lifecycle stage">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LIFECYCLE_STAGES.map((stage) => (
          <SelectItem key={stage.id} value={stage.id}>
            {stage.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** Lifecycle, lead source, and when the record last changed. */
const CustomerSection = ({
  resource,
}: {
  resource: "contacts" | "companies";
}) => {
  const record = useRecordContext<CustomerRecord>();
  if (!record) return null;
  return (
    <AsideSection title="Customer">
      <LifecycleSelector resource={resource} />
      <div className="text-muted-foreground">
        Lead source:{" "}
        <span className="text-foreground">
          {record.lead_source || "Not known"}
        </span>
        {record.lead_source_detail ? ` (${record.lead_source_detail})` : null}
      </div>
      {record.updated_at ? (
        <div className="flex items-center justify-between text-muted-foreground">
          <span>
            Updated <RelativeDate date={record.updated_at} />
          </span>
          <span className="flex">
            <RunAutomationButton object={resource} />
            <HistoryButton resource={resource} />
          </span>
        </div>
      ) : null}
    </AsideSection>
  );
};

/** The customer section and custom fields in a contact's or company's aside. */
export const CustomerAside = ({
  resource,
}: {
  resource: "contacts" | "companies";
}) => (
  <>
    <CustomerSection resource={resource} />
    <CustomFieldsAside resource={resource} />
  </>
);
