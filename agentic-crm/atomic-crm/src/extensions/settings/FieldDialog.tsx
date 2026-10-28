/* eslint-disable react-refresh/only-export-components */
import { useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { crmApi, errorMessage } from "../api";
import { metadataKey, useMetadata } from "../objects/model";
import type { Choice, FieldDefinition, FieldType } from "../types";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  long_text: "Long text",
  number: "Number",
  currency: "Amount of money",
  date: "Date",
  datetime: "Date and time",
  boolean: "Yes or no",
  select: "One choice",
  multi_select: "Several choices",
  email: "Email address",
  phone: "Phone number",
  url: "Link",
  rating: "Rating (1 to 5)",
  relation: "Link to a record",
};

const valueOf = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

type FieldDialogProps = {
  object: string;
  field?: FieldDefinition;
  onClose: () => void;
};

/** Adds a field to an object, or changes one. A field's type is set once. */
export const FieldDialog = ({ object, field, onClose }: FieldDialogProps) => {
  const { data: metadata } = useMetadata();
  const [label, setLabel] = useState(field?.label ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [required, setRequired] = useState(field?.required ?? false);
  const [choices, setChoices] = useState<Choice[]>(
    field?.options.choices ?? [],
  );
  const [target, setTarget] = useState(field?.options.target ?? "contacts");
  const [currency, setCurrency] = useState(field?.options.currency ?? "");
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();
  const hasChoices = type === "select" || type === "multi_select";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const options = {
      ...(hasChoices
        ? {
            choices: choices
              .filter((choice) => choice.label.trim())
              .map((choice) => ({
                ...choice,
                value: choice.value || valueOf(choice.label),
              })),
          }
        : {}),
      ...(type === "relation" ? { target } : {}),
      ...(type === "currency" && currency ? { currency } : {}),
    };
    setSaving(true);
    try {
      await crmApi(
        field
          ? `/metadata/objects/${object}/fields/${field.name}`
          : `/metadata/objects/${object}/fields`,
        {
          method: field ? "PUT" : "POST",
          body: field
            ? { label, required, options }
            : { label, type, required, options },
        },
      );
      await queryClient.invalidateQueries({ queryKey: metadataKey });
      onClose();
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>{field ? "Change field" : "Add a field"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="field-label">Name</Label>
            <Input
              id="field-label"
              required
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Type</Label>
            <Select
              value={type}
              disabled={Boolean(field)}
              onValueChange={(next) => setType(next as FieldType)}
            >
              <SelectTrigger aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((each) => (
                  <SelectItem key={each} value={each}>
                    {FIELD_TYPE_LABELS[each]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasChoices ? (
            <div className="flex flex-col gap-2">
              <Label>Choices</Label>
              {choices.map((choice, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    aria-label={`Choice ${index + 1}`}
                    value={choice.label}
                    onChange={(event) =>
                      setChoices(
                        choices.map((each, at) =>
                          at === index
                            ? { ...each, label: event.target.value }
                            : each,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove choice"
                    onClick={() =>
                      setChoices(choices.filter((_, at) => at !== index))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() =>
                  setChoices([...choices, { value: "", label: "" }])
                }
              >
                <Plus className="size-4" />
                Add a choice
              </Button>
            </div>
          ) : null}
          {type === "relation" ? (
            <div className="flex flex-col gap-1">
              <Label>Links to</Label>
              <Select
                value={target}
                disabled={Boolean(field)}
                onValueChange={setTarget}
              >
                <SelectTrigger aria-label="Links to">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(metadata?.objects ?? []).map((each) => (
                    <SelectItem key={each.name} value={each.name}>
                      {each.label_plural}
                    </SelectItem>
                  ))}
                  <SelectItem value="sales">People on the team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {type === "currency" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="field-currency">
                Currency code (leave empty for the CRM's)
              </Label>
              <Input
                id="field-currency"
                maxLength={3}
                placeholder="USD"
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            Required
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !label.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
