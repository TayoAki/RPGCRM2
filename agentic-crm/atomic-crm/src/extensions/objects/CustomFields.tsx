import { useQueryClient } from "@tanstack/react-query";
import { useInput, useNotify, useRecordContext, useUpdate } from "ra-core";
import { History, Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { AsideSection } from "../../components/atomic-crm/misc/AsideSection";
import type { FieldDefinition } from "../types";
import { FieldDisplay } from "./FieldDisplay";
import { FieldInput } from "./FieldInput";
import { HistoryPanel } from "./HistoryPanel";
import { historyKey, useAccess, useObject } from "./model";

type Extensible = "contacts" | "companies" | "deals";

type CrmRecord = {
  id: number | string;
  custom_fields?: Record<string, unknown> | null;
};

/** The custom fields a person may see on an object, and the ones they may change. */
const useCustomFields = (resource: Extensible) => {
  const { fields } = useObject(resource);
  const { data: access } = useAccess();
  const rules = access?.objects[resource];
  const hidden = new Set(rules?.hidden ?? []);
  const readOnly = new Set(rules?.read_only ?? []);
  const visible = fields.filter(
    (field) => !field.standard && !hidden.has(field.name),
  );
  return {
    visible,
    editable: visible.filter((field) => !readOnly.has(field.name)),
    canUpdate: rules?.update !== "none",
  };
};

const EditDialog = ({
  resource,
  record,
  fields,
  onClose,
}: {
  resource: Extensible;
  record: CrmRecord;
  fields: FieldDefinition[];
  onClose: () => void;
}) => {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => record.custom_fields ?? {},
  );
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const changed = Object.fromEntries(
      fields.map((field) => [field.name, values[field.name] ?? null]),
    );
    update(
      resource,
      { id: record.id, data: { custom_fields: changed }, previousData: record },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: historyKey(resource, record.id),
          });
          onClose();
        },
        onError: (error) =>
          notify(error instanceof Error ? error.message : "Couldn't save.", {
            type: "error",
          }),
      },
    );
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>More fields</DialogTitle>
          </DialogHeader>
          {fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1">
              <Label>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              <FieldInput
                field={field}
                value={values[field.name]}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.name]: value }))
                }
              />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** A record's custom fields in its aside, with a dialog to change them. */
export const CustomFieldsAside = ({ resource }: { resource: Extensible }) => {
  const record = useRecordContext<CrmRecord>();
  const { visible, editable, canUpdate } = useCustomFields(resource);
  const [editing, setEditing] = useState(false);
  if (!record || !visible.length) return null;
  return (
    <AsideSection title="More fields">
      {visible.map((field) => (
        <div key={field.name} className="flex flex-col">
          <span className="text-xs text-muted-foreground tracking-wide">
            {field.label}
          </span>
          <FieldDisplay
            field={field}
            value={record.custom_fields?.[field.name]}
          />
        </div>
      ))}
      {canUpdate && editable.length ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-1 self-start"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-4" />
          Change
        </Button>
      ) : null}
      {editing ? (
        <EditDialog
          resource={resource}
          record={record}
          fields={editable}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </AsideSection>
  );
};

/** Opens a record's history: who changed what, and when. */
export const HistoryButton = ({ resource }: { resource: Extensible }) => {
  const record = useRecordContext<CrmRecord>();
  const { fields } = useObject(resource);
  const [open, setOpen] = useState(false);
  if (!record) return null;
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <History className="size-4" />
        History
      </Button>
      {open ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>History</DialogTitle>
            </DialogHeader>
            <HistoryPanel object={resource} id={record.id} fields={fields} />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};

const CustomFieldInput = ({ field }: { field: FieldDefinition }) => {
  const { field: input } = useInput({ source: `custom_fields.${field.name}` });
  return (
    <div className="flex flex-col gap-1">
      <Label>
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      <FieldInput field={field} value={input.value} onChange={input.onChange} />
    </div>
  );
};

/** The custom fields in a record's create and edit forms. */
export const CustomFieldInputs = ({ resource }: { resource: Extensible }) => {
  const { editable } = useCustomFields(resource);
  if (!editable.length) return null;
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">More fields</h6>
      {editable.map((field) => (
        <CustomFieldInput key={field.name} field={field} />
      ))}
    </div>
  );
};
