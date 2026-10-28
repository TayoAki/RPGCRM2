import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { crmApi } from "../api";
import type { FieldDefinition } from "../types";
import { FieldDisplay } from "./FieldDisplay";
import { historyKey } from "./model";

type Change = { field: string; from: unknown; to: unknown };

type HistoryEvent = {
  id: number;
  at: string;
  action: "created" | "updated" | "deleted";
  by: {
    kind: "person" | "automation" | "system" | "unknown";
    name?: string;
    id?: number;
  };
  changes: Change[];
};

const humanize = (name: string) => {
  const words = name.replaceAll("_", " ");
  return words[0].toUpperCase() + words.slice(1);
};

const Who = ({ by }: { by: HistoryEvent["by"] }) => {
  if (by.kind === "person")
    return <span className="font-medium">{by.name}</span>;
  if (by.kind === "automation" && by.id) {
    return (
      <Link to={`/automations/${by.id}`} className="font-medium underline">
        An automation
      </Link>
    );
  }
  return <span className="font-medium">The CRM</span>;
};

const Value = ({
  field,
  value,
}: {
  field: FieldDefinition | undefined;
  value: unknown;
}) =>
  field ? (
    <FieldDisplay field={field} value={value} />
  ) : (
    <span>
      {value === null || value === undefined
        ? "-"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value)}
    </span>
  );

/** Who changed a record and what they changed, newest first. */
export const HistoryPanel = ({
  object,
  id,
  fields,
}: {
  object: string;
  id: unknown;
  fields: FieldDefinition[];
}) => {
  const { data: events = [], isPending } = useQuery({
    queryKey: historyKey(object, id),
    queryFn: () => crmApi<HistoryEvent[]>(`/history/${object}/${id}`),
  });
  if (isPending) return null;
  const visible = events.filter(
    (event) => event.action !== "updated" || event.changes.length,
  );
  if (!visible.length) {
    return (
      <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
    );
  }
  return (
    <ol className="flex flex-col gap-3 text-sm">
      {visible.map((event) => (
        <li key={event.id} className="flex flex-col gap-1">
          <div>
            <Who by={event.by} />{" "}
            {event.action === "updated" ? "changed" : event.action} it{" "}
            <span className="text-muted-foreground">
              <RelativeDate date={event.at} />
            </span>
          </div>
          {event.changes.map((change) => {
            const field = fields.find((each) => each.name === change.field);
            return (
              <div
                key={change.field}
                className="flex flex-wrap items-center gap-1 pl-3 text-muted-foreground"
              >
                <span>{field?.label ?? humanize(change.field)}:</span>
                <Value field={field} value={change.from} />
                <span aria-hidden>{"->"}</span>
                <span className="sr-only">to</span>
                <Value field={field} value={change.to} />
              </div>
            );
          })}
        </li>
      ))}
    </ol>
  );
};
