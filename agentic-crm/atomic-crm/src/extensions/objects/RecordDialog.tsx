import { useCreate, useNotify } from "ra-core";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import type { FieldDefinition, ObjectDefinition } from "../types";
import { FieldInput } from "./FieldInput";
import { recordPath } from "./model";

type RecordDialogProps = {
  object: ObjectDefinition;
  fields: FieldDefinition[];
  onClose: () => void;
};

/** Adds a record of a custom object, then opens it. */
export const RecordDialog = ({
  object,
  fields,
  onClose,
}: RecordDialogProps) => {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [create, { isPending }] = useCreate();
  const notify = useNotify();
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create(
      object.name,
      { data: values },
      {
        onSuccess: (record) => navigate(recordPath(object.name, record.id)),
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
            <DialogTitle>New {object.label_singular.toLowerCase()}</DialogTitle>
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
