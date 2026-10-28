/* eslint-disable react-refresh/only-export-components */
import { useNotify } from "ra-core";
import { Copy } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { ArrayInput } from "@/components/admin/array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { MailboxCard } from "../mail/MailboxCard";
import { useAutomationInfo } from "../queries";

/** The settings this fork adds to the CRM's configuration. */
export type AutomationConfig = {
  timezone?: string;
  businessName?: string;
  businessDescription?: string;
  meetingOutcomes?: string[];
  leadSources?: string[];
  proposalTemplate?: string;
  proposalEmailSubject?: string;
  proposalEmailBody?: string;
};

export const AUTOMATION_SECTIONS = [
  { id: "mail", label: "Email", fallback: "Email" },
  { id: "automations", label: "Automations", fallback: "Automations" },
  { id: "data-model", label: "Data model", fallback: "Data model" },
];

const labels = (list: string[] | undefined) =>
  (list ?? []).map((label) => ({ label }));
const strings = (list: { label?: string }[] | undefined) =>
  (list ?? []).map((item) => item.label?.trim() ?? "").filter(Boolean);

/** The form's starting values, from the saved configuration and the server's defaults. */
export const automationFormValues = (
  config: AutomationConfig,
  defaults: { meeting_outcomes: string[]; lead_sources: string[] } | undefined,
) => ({
  timezone: config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  businessName: config.businessName ?? "",
  businessDescription: config.businessDescription ?? "",
  meetingOutcomes: labels(config.meetingOutcomes ?? defaults?.meeting_outcomes),
  leadSources: labels(config.leadSources ?? defaults?.lead_sources),
  proposalTemplate: config.proposalTemplate ?? "",
  proposalEmailSubject: config.proposalEmailSubject ?? "",
  proposalEmailBody: config.proposalEmailBody ?? "",
});

/** The form's values, as saved in the configuration. */
export const automationConfig = (
  data: Record<string, any>,
): AutomationConfig => ({
  timezone: data.timezone,
  businessName: data.businessName,
  businessDescription: data.businessDescription,
  meetingOutcomes: strings(data.meetingOutcomes),
  leadSources: strings(data.leadSources),
  proposalTemplate: data.proposalTemplate,
  proposalEmailSubject: data.proposalEmailSubject,
  proposalEmailBody: data.proposalEmailBody,
});

const BookingAddress = () => {
  const { data: info } = useAutomationInfo();
  const notify = useNotify();
  if (!info?.booking_url) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-muted-foreground">Bookings</h3>
      <p className="text-sm text-muted-foreground">
        Give this address to your booking tool as a webhook. Each booking adds
        the contact (with where they came from) and the meeting; moving or
        canceling it updates the meeting. In Cal.com: Settings, Developer,
        Webhooks. In Calendly: Integrations, Webhooks. A website form can post
        JSON with email, name and start_at.
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={info.booking_url}
          className="font-mono text-xs"
          aria-label="Booking address"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copy the booking address"
          onClick={() =>
            void navigator.clipboard
              .writeText(info.booking_url ?? "")
              .then(() => notify("Copied."))
          }
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
};

/** The Email, Data model and Automations sections of the settings page. */
export const AutomationSettings = () => {
  const zones = useMemo(
    () =>
      Intl.supportedValuesOf("timeZone").map((zone) => ({
        id: zone,
        name: zone,
      })),
    [],
  );
  return (
    <>
      <MailboxCard scope="shared" />
      <Card id="data-model">
        <CardContent className="space-y-2">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Data model and roles
          </h2>
          <p className="text-sm text-muted-foreground">
            Add fields to contacts, companies and deals, add objects of your
            own, and choose what each person can see and change.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/settings/data-model">Data model</Link>
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/settings/roles">Roles</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card id="automations">
        <CardContent className="space-y-4">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Automations
          </h2>
          <AutocompleteInput
            source="timezone"
            label="Time zone"
            choices={zones}
            helperText="Reminders and schedules use it."
          />
          <TextInput
            source="businessName"
            label="Your business's name"
            helperText={false}
          />
          <TextInput
            source="businessDescription"
            label="What you sell, in a few lines"
            multiline
            helperText="The AI uses it when it writes proposals and emails."
          />
          <BookingAddress />
          <h3 className="text-lg font-medium text-muted-foreground">
            Call outcomes
          </h3>
          <p className="text-sm text-muted-foreground">
            The choices on the call outcome form. The ready-made automations
            look for "Send proposal", "Interested", "Follow up later", "Not a
            fit" and "No show".
          </p>
          <ArrayInput source="meetingOutcomes" label={false} helperText={false}>
            <SimpleFormIterator disableReordering disableClear>
              <TextInput source="label" label={false} />
            </SimpleFormIterator>
          </ArrayInput>
          <h3 className="text-lg font-medium text-muted-foreground">
            Lead sources
          </h3>
          <ArrayInput source="leadSources" label={false} helperText={false}>
            <SimpleFormIterator disableReordering disableClear>
              <TextInput source="label" label={false} />
            </SimpleFormIterator>
          </ArrayInput>
          <h3 className="text-lg font-medium text-muted-foreground">
            Proposals
          </h3>
          <TextInput
            source="proposalTemplate"
            label="Template the AI follows"
            multiline
            helperText="Markdown. Your usual sections, standard terms and prices."
          />
          <TextInput
            source="proposalEmailSubject"
            label="Email subject"
            helperText="Default: Your proposal: {title}"
          />
          <TextInput
            source="proposalEmailBody"
            label="Email message"
            multiline
            helperText="Use {first_name}, {title}, {url} and {sender}."
          />
        </CardContent>
      </Card>
    </>
  );
};
