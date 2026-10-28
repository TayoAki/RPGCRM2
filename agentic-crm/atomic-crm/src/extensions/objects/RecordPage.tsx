import { useQueryClient } from "@tanstack/react-query";
import { useDelete, useGetOne, useNotify, useUpdate } from "ra-core";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import type { FieldDefinition } from "../types";
import { FieldDisplay } from "./FieldDisplay";
import { FieldInput } from "./FieldInput";
import { HistoryPanel } from "./HistoryPanel";
import { LinkedPanel } from "./LinkedPanel";
import {
  bodyOf,
  historyKey,
  isCustomObject,
  titleOf,
  useAccess,
  useObject,
  valueOf,
} from "./model";
import { NotesPanel } from "./NotesPanel";

// Kept by the CRM itself.
const MANAGED = new Set(["updated_at", "created_at"]);

const FieldsCard = ({
  name,
  record,
  fields,
  custom,
  editable,
}: {
  name: string;
  record: Record<string, unknown>;
  fields: FieldDefinition[];
  custom: boolean;
  editable: (field: FieldDefinition) => boolean;
}) => {
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const canEdit = fields.some(editable);

  const save = () => {
    if (!values) return;
    update(
      name,
      {
        id: record.id as number,
        data: bodyOf(fields.filter(editable), values, custom),
        previousData: record,
      },
      {
        onSuccess: () => {
          setValues(null);
          void queryClient.invalidateQueries({
            queryKey: historyKey(name, record.id),
          });
        },
        onError: (error) =>
          notify(error instanceof Error ? error.message : "Couldn't save.", {
            type: "error",
          }),
      },
    );
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Details</h2>
          {canEdit && !values ? (
            <Button variant="outline" size="sm" onClick={() => setValues({})}>
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
          {fields.map((field) => (
            <div key={field.name} className="contents">
              <dt className="text-sm text-muted-foreground">
                {values && editable(field) ? (
                  <Label>{field.label}</Label>
                ) : (
                  field.label
                )}
              </dt>
              <dd className="text-sm">
                {values && editable(field) ? (
                  <FieldInput
                    field={field}
                    value={
                      field.name in values
                        ? values[field.name]
                        : valueOf(record, field, custom)
                    }
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: value,
                      }))
                    }
                  />
                ) : (
                  <FieldDisplay
                    field={field}
                    value={valueOf(record, field, custom)}
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
        {values ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setValues(null)}>
              Cancel
            </Button>
            <Button disabled={isPending} onClick={save}>
              Save
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

/** One record of any object: its fields, the records linked to it, its notes and its history. */
export const RecordPage = () => {
  const { object: name = "", id = "" } = useParams();
  const { object, fields } = useObject(name);
  const { data: access } = useAccess();
  const { data: record, error } = useGetOne(name, { id });
  const [remove] = useDelete();
  const notify = useNotify();
  const navigate = useNavigate();

  if (error) {
    return (
      <p className="mt-4 text-muted-foreground">This record isn't here.</p>
    );
  }
  if (!object || !record) return null;
  const custom = isCustomObject(object);
  const rules = access?.objects[name];
  const hidden = new Set(rules?.hidden ?? []);
  const readOnly = new Set(rules?.read_only ?? []);
  const visible = fields.filter((field) => !hidden.has(field.name));
  const editable = (field: FieldDefinition) =>
    rules?.update !== "none" &&
    !readOnly.has(field.name) &&
    !MANAGED.has(field.name);

  const deleteRecord = () => {
    if (!window.confirm(`Delete ${titleOf(name, record)}?`)) return;
    remove(
      name,
      { id: record.id, previousData: record },
      {
        onSuccess: () => navigate(`/o/${name}`),
        onError: (failure) =>
          notify(
            failure instanceof Error ? failure.message : "Couldn't delete.",
            { type: "error" },
          ),
      },
    );
  };

  return (
    <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link
              to={`/o/${name}`}
              aria-label={`Back to ${object.label_plural}`}
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">
              {object.label_singular}
            </p>
            <h1 className="text-2xl font-semibold">{titleOf(name, record)}</h1>
          </div>
        </div>
        {rules?.delete !== "none" ? (
          <Button variant="outline" size="sm" onClick={deleteRecord}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <FieldsCard
            name={name}
            record={record}
            fields={visible}
            custom={custom}
            editable={editable}
          />
          <LinkedPanel object={name} id={record.id} />
          {custom ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <h2 className="font-semibold">Notes</h2>
                <NotesPanel
                  object={name}
                  id={record.id}
                  canAdd={rules?.update !== "none"}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
        <Card className="self-start">
          <CardContent className="flex flex-col gap-3">
            <h2 className="font-semibold">History</h2>
            <HistoryPanel object={name} id={record.id} fields={fields} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
