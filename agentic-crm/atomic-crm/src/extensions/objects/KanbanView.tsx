import { useNotify, useUpdate } from "ra-core";
import { type DragEvent, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

import type { Choice, FieldDefinition } from "../types";
import { FieldDisplay } from "./FieldDisplay";
import { bodyOf, recordPath, titleOf, valueOf } from "./model";

const NONE = "__none__";

type KanbanViewProps = {
  object: string;
  custom: boolean;
  groupBy: FieldDefinition;
  choices: Choice[] | undefined;
  details: FieldDefinition[];
  records: Record<string, unknown>[];
  canMove: boolean;
};

const keyOf = (value: unknown) =>
  value === null || value === undefined || value === "" ? NONE : String(value);

/** Records in columns by one field; dragging a card to another column changes that field. */
export const KanbanView = ({
  object,
  custom,
  groupBy,
  choices,
  details,
  records,
  canMove,
}: KanbanViewProps) => {
  const [update] = useUpdate();
  const notify = useNotify();
  const [over, setOver] = useState<string | null>(null);

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const choice of choices ?? []) groups.set(choice.value, []);
  for (const record of records) {
    const key = keyOf(valueOf(record, groupBy, custom));
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const labelOf = (key: string) =>
    key === NONE
      ? `No ${groupBy.label.toLowerCase()}`
      : (choices?.find((choice) => choice.value === key)?.label ?? key);

  const drop = (event: DragEvent, key: string) => {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData("text/plain");
    const record = records.find((each) => String(each.id) === id);
    if (!record || keyOf(valueOf(record, groupBy, custom)) === key) return;
    const value =
      key === NONE ? null : groupBy.type === "boolean" ? key === "true" : key;
    update(
      object,
      {
        id: record.id as number,
        data: bodyOf([groupBy], { [groupBy.name]: value }, custom),
        previousData: record,
      },
      {
        onError: (error) =>
          notify(error instanceof Error ? error.message : "Couldn't move.", {
            type: "error",
          }),
      },
    );
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {[...groups.entries()].map(([key, items]) => (
        <section
          key={key}
          aria-label={labelOf(key)}
          className={cn(
            "flex w-64 shrink-0 flex-col gap-2 rounded-md bg-muted/50 p-2",
            over === key && "ring-2 ring-primary",
          )}
          onDragOver={(event) => {
            if (!canMove) return;
            event.preventDefault();
            setOver(key);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(event) => drop(event, key)}
        >
          <h3 className="flex justify-between px-1 text-sm font-medium">
            {labelOf(key)}
            <span className="text-muted-foreground">{items.length}</span>
          </h3>
          {items.map((record) => (
            <article
              key={String(record.id)}
              draggable={canMove}
              onDragStart={(event) =>
                event.dataTransfer.setData("text/plain", String(record.id))
              }
              className="flex flex-col gap-1 rounded-md border bg-card p-2 text-sm shadow-xs"
            >
              <Link
                to={recordPath(object, record.id)}
                className="font-medium hover:underline"
              >
                {titleOf(object, record)}
              </Link>
              {details.map((field) => (
                <div key={field.name} className="text-xs text-muted-foreground">
                  <FieldDisplay
                    field={field}
                    value={valueOf(record, field, custom)}
                  />
                </div>
              ))}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
};
