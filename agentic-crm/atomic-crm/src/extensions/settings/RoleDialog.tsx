/* eslint-disable react-refresh/only-export-components */
import { useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { crmApi, errorMessage } from "../api";
import { useMetadata } from "../objects/model";
import type { ObjectRule, Reach, Role } from "../types";

export const rolesKey = ["crm", "roles"];

const REACH_LABELS: Record<Reach, string> = {
  all: "All",
  own: "Their own",
  none: "None",
};

const VISIBLE = "visible";

const ReachSelect = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Reach;
  onChange: (value: Reach) => void;
}) => (
  <Select value={value} onValueChange={(next) => onChange(next as Reach)}>
    <SelectTrigger aria-label={label} className="h-8 w-28">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {(Object.keys(REACH_LABELS) as Reach[]).map((reach) => (
        <SelectItem key={reach} value={reach}>
          {REACH_LABELS[reach]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

type RoleDialogProps = { role?: Role; onClose: () => void };

/** What people with a role may see and change: per object, and per field. */
export const RoleDialog = ({ role, onClose }: RoleDialogProps) => {
  const { data: metadata } = useMetadata();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [objects, setObjects] = useState(role?.rules.objects ?? {});
  const [fieldRules, setFieldRules] = useState(role?.rules.fields ?? {});
  const [fieldsOf, setFieldsOf] = useState("contacts");
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const rule = (object: string): Required<ObjectRule> => ({
    read: "all",
    create: true,
    update: "all",
    delete: "all",
    ...objects[object],
  });
  const setRule = (object: string, change: ObjectRule) =>
    setObjects({ ...objects, [object]: { ...rule(object), ...change } });
  const setFieldRule = (field: string, value: string) => {
    const current = { ...fieldRules[fieldsOf] };
    if (value === VISIBLE) delete current[field];
    else current[field] = value as "hidden" | "read_only";
    setFieldRules({ ...fieldRules, [fieldsOf]: current });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await crmApi(role ? `/roles/${role.id}` : "/roles", {
        method: role ? "PUT" : "POST",
        body: { name, description, rules: { objects, fields: fieldRules } },
      });
      await queryClient.invalidateQueries({ queryKey: rolesKey });
      onClose();
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
      setSaving(false);
    }
  };

  const fields = (metadata?.fields ?? []).filter(
    (field) => field.object === fieldsOf,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{role ? "Change role" : "New role"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">Records</h3>
            <p className="text-sm text-muted-foreground">
              "Their own" means the records they own. Notes, email and history
              follow the record they belong to.
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>See</TableHead>
                    <TableHead>Add</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(metadata?.objects ?? []).map((object) => {
                    const current = rule(object.name);
                    return (
                      <TableRow key={object.name}>
                        <TableCell className="font-medium">
                          {object.label_plural}
                        </TableCell>
                        <TableCell>
                          <ReachSelect
                            label={`See ${object.label_plural}`}
                            value={current.read}
                            onChange={(read) => setRule(object.name, { read })}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            aria-label={`Add ${object.label_plural}`}
                            checked={current.create}
                            onCheckedChange={(checked) =>
                              setRule(object.name, { create: checked === true })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <ReachSelect
                            label={`Change ${object.label_plural}`}
                            value={current.update}
                            onChange={(update) =>
                              setRule(object.name, { update })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <ReachSelect
                            label={`Delete ${object.label_plural}`}
                            value={current.delete}
                            onChange={(remove) =>
                              setRule(object.name, { delete: remove })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">Fields of</h3>
              <Select value={fieldsOf} onValueChange={setFieldsOf}>
                <SelectTrigger aria-label="Fields of" className="h-8 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(metadata?.objects ?? []).map((object) => (
                    <SelectItem key={object.name} value={object.name}>
                      {object.label_plural}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  {field.label}
                  <Select
                    value={fieldRules[fieldsOf]?.[field.name] ?? VISIBLE}
                    onValueChange={(value) => setFieldRule(field.name, value)}
                  >
                    <SelectTrigger
                      aria-label={`${field.label} access`}
                      className="h-8 w-32"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VISIBLE}>Can change</SelectItem>
                      <SelectItem value="read_only">Read only</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
