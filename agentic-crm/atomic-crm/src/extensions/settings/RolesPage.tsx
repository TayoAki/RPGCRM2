import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanAccess, useGetList, useNotify, useUpdate } from "ra-core";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Sale } from "../../components/atomic-crm/types";
import { crmApi, errorMessage } from "../api";
import type { Role } from "../types";
import { RoleDialog, rolesKey } from "./RoleDialog";

const NO_ROLE = "__none__";

type Person = Sale & { role_id?: number | null };

const People = ({ roles }: { roles: Role[] }) => {
  const { data: people = [] } = useGetList<Person>("sales", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "first_name", order: "ASC" },
  });
  const [update] = useUpdate();
  const notify = useNotify();
  return (
    <ul className="flex flex-col divide-y">
      {people.map((person) => (
        <li
          key={person.id}
          className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
        >
          <span>
            {person.first_name} {person.last_name}
            {person.disabled ? (
              <span className="text-muted-foreground"> (disabled)</span>
            ) : null}
          </span>
          {person.administrator ? (
            <Badge variant="secondary">Admin: can do everything</Badge>
          ) : (
            <Select
              value={person.role_id ? String(person.role_id) : NO_ROLE}
              onValueChange={(value) =>
                update(
                  "sales",
                  {
                    id: person.id,
                    data: { role_id: value === NO_ROLE ? null : Number(value) },
                    previousData: person,
                  },
                  {
                    onError: (error) =>
                      notify(errorMessage(error), { type: "error" }),
                  },
                )
              }
            >
              <SelectTrigger
                aria-label={`Role of ${person.first_name} ${person.last_name}`}
                className="h-8 w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROLE}>No role (full access)</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </li>
      ))}
    </ul>
  );
};

/** Roles limit what a person sees and changes; admins give them to people here. */
export const RolesPage = () => {
  const { canAccess: isAdmin, isPending } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const { data: roles = [] } = useQuery({
    queryKey: rolesKey,
    queryFn: () => crmApi<Role[]>("/roles"),
    enabled: isAdmin === true,
  });
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const notify = useNotify();
  const queryClient = useQueryClient();

  if (isPending) return null;
  if (!isAdmin) {
    return (
      <p className="mt-4 text-muted-foreground">
        Only an admin can manage roles.
      </p>
    );
  }

  const remove = async (role: Role) => {
    if (
      !window.confirm(
        `Delete the role "${role.name}"? People with it get full access.`,
      )
    )
      return;
    try {
      await crmApi(`/roles/${role.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: rolesKey });
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };

  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-sm text-muted-foreground">
            The CRM, the Bot and automations started by a person all keep to
            that person's role.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/settings/data-model">Data model</Link>
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            New role
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3">
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roles yet. Without one, a person can see and change every
              record.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {roles.map((role) => (
                <li
                  key={role.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div>
                    <div className="font-medium">{role.name}</div>
                    {role.description ? (
                      <div className="text-sm text-muted-foreground">
                        {role.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Change ${role.name}`}
                      onClick={() => setEditing(role)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${role.name}`}
                      onClick={() => remove(role)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="font-semibold">People</h2>
          <People roles={roles} />
        </CardContent>
      </Card>
      {editing ? (
        <RoleDialog
          role={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
};
