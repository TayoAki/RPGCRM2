import { useQueryClient } from "@tanstack/react-query";
import { useCanAccess, useNotify } from "ra-core";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { crmApi, errorMessage } from "../api";
import { metadataKey, useMetadata } from "../objects/model";
import type { FieldDefinition, ObjectDefinition } from "../types";
import { FIELD_TYPE_LABELS, FieldDialog } from "./FieldDialog";
import { ObjectDialog } from "./ObjectDialog";

type Editing =
  | { kind: "field"; field?: FieldDefinition }
  | { kind: "object"; object?: ObjectDefinition }
  | null;

const FieldsTable = ({
  object,
  fields,
  onEdit,
  onRemove,
}: {
  object: ObjectDefinition;
  fields: FieldDefinition[];
  onEdit: (field: FieldDefinition) => void;
  onRemove: (field: FieldDefinition) => void;
}) => (
  <div className="overflow-x-auto rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Type</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => {
          const locked =
            field.standard || (!object.standard && field.name === "name");
          return (
            <TableRow key={field.name}>
              <TableCell>
                {field.label}
                {field.required ? " *" : ""}
                {field.standard ? (
                  <Badge variant="outline" className="ml-2">
                    Built in
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {FIELD_TYPE_LABELS[field.type]}
                {field.options.choices?.length
                  ? `: ${field.options.choices.map((choice) => choice.label).join(", ")}`
                  : ""}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {!field.standard ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Change ${field.label}`}
                    onClick={() => onEdit(field)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
                {!locked ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${field.label}`}
                    onClick={() => onRemove(field)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

/** The objects and fields the CRM keeps: admins add fields to any object, and objects of their own. */
export const DataModelPage = () => {
  const { data } = useMetadata();
  const { canAccess: isAdmin, isPending } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const [selected, setSelected] = useState("contacts");
  const [editing, setEditing] = useState<Editing>(null);
  const notify = useNotify();
  const queryClient = useQueryClient();

  if (isPending || !data) return null;
  if (!isAdmin) {
    return (
      <p className="mt-4 text-muted-foreground">
        Only an admin can change the data model.
      </p>
    );
  }
  const object =
    data.objects.find((each) => each.name === selected) ?? data.objects[0];
  if (!object) return null;
  const fields = data.fields.filter((field) => field.object === object.name);

  const removeField = async (field: FieldDefinition) => {
    if (
      !window.confirm(
        `Delete the field "${field.label}"? Its values on every record go with it.`,
      )
    )
      return;
    try {
      await crmApi(`/metadata/objects/${object.name}/fields/${field.name}`, {
        method: "DELETE",
      });
      await queryClient.invalidateQueries({ queryKey: metadataKey });
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };
  const removeObject = async () => {
    if (
      !window.confirm(
        `Delete ${object.label_plural} and every one of its records?`,
      )
    )
      return;
    try {
      await crmApi(`/metadata/objects/${object.name}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: metadataKey });
      setSelected("contacts");
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };

  return (
    <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Data model</h1>
          <p className="text-sm text-muted-foreground">
            Fields you add show on records, in lists, filters and saved views,
            and to automations and the Bot.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/settings/roles">Roles</Link>
          </Button>
          <Button onClick={() => setEditing({ kind: "object" })}>
            <Plus className="size-4" />
            New object
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          {data.objects.map((each) => (
            <button
              key={each.name}
              type="button"
              onClick={() => setSelected(each.name)}
              className={cn(
                "rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted",
                each.name === object.name && "bg-muted font-medium",
              )}
            >
              {each.label_plural}
            </button>
          ))}
        </nav>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{object.label_plural}</h2>
              <div className="flex gap-2">
                {!object.standard ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ kind: "object", object })}
                    >
                      Rename
                    </Button>
                    <Button variant="ghost" size="sm" onClick={removeObject}>
                      Delete
                    </Button>
                  </>
                ) : null}
                <Button size="sm" onClick={() => setEditing({ kind: "field" })}>
                  <Plus className="size-4" />
                  Add a field
                </Button>
              </div>
            </div>
            <FieldsTable
              object={object}
              fields={fields}
              onEdit={(field) => setEditing({ kind: "field", field })}
              onRemove={removeField}
            />
            <Link to={`/o/${object.name}`} className="text-sm underline">
              See {object.label_plural.toLowerCase()}
            </Link>
          </CardContent>
        </Card>
      </div>
      {editing?.kind === "field" ? (
        <FieldDialog
          object={object.name}
          field={editing.field}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === "object" ? (
        <ObjectDialog
          object={editing.object}
          onSaved={(name) => {
            setEditing(null);
            setSelected(name);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
};
