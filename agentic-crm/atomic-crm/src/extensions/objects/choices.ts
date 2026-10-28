import { useConfigurationContext } from "../../components/atomic-crm/root/ConfigurationContext";
import { LIFECYCLE_STAGES } from "../fields/CustomerFields";
import type { Choice, FieldDefinition } from "../types";

const BOOLEAN: Choice[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const STATUSES: Record<string, Choice[]> = {
  "meetings.status": [
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Completed" },
    { value: "no_show", label: "No-show" },
    { value: "canceled", label: "Canceled" },
  ],
  "proposals.status": [
    "draft",
    "ready",
    "scheduled",
    "sent",
    "viewed",
    "accepted",
    "declined",
  ].map((value) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
  })),
};

/** The values a field takes, when they are known: its own choices, or the CRM's settings for it. */
export function useFieldChoices() {
  const { dealStages, noteStatuses } = useConfigurationContext();
  return (field: FieldDefinition): Choice[] | undefined => {
    if (field.options.choices?.length) return field.options.choices;
    if (field.type === "boolean") return BOOLEAN;
    const key = `${field.object}.${field.name}`;
    if (key === "deals.stage") return dealStages;
    if (key === "contacts.status") return noteStatuses;
    if (field.name === "lifecycle_stage") {
      return LIFECYCLE_STAGES.map((stage) => ({
        value: stage.id,
        label: stage.name,
      }));
    }
    return STATUSES[key];
  };
}

/** Fields a board can be grouped by. */
export const groupable = (field: FieldDefinition) =>
  ["select", "boolean", "text"].includes(field.type);
