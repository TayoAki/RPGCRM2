import { useCanAccess } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { ObjectDefinition } from "../types";
import { useAccess, useMetadata } from "./model";

const ObjectLinks = ({ objects }: { objects: ObjectDefinition[] }) => (
  <ul className="grid gap-2 sm:grid-cols-2">
    {objects.map((object) => (
      <li key={object.name}>
        <Link
          to={`/o/${object.name}`}
          className="block rounded-md border p-3 hover:bg-muted"
        >
          <span className="font-medium">{object.label_plural}</span>
          {object.description ? (
            <span className="block text-sm text-muted-foreground">
              {object.description}
            </span>
          ) : null}
        </Link>
      </li>
    ))}
  </ul>
);

/** Every kind of record in the CRM, to open as a table, a board or a calendar. */
export const ObjectsIndex = () => {
  const { data } = useMetadata();
  const { data: access } = useAccess();
  const { canAccess: isAdmin = false } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const readable = (data?.objects ?? []).filter(
    (object) => access?.objects[object.name]?.read !== "none",
  );
  const custom = readable.filter((object) => !object.standard);
  const standard = readable.filter((object) => object.standard);
  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Records</h1>
        {isAdmin ? (
          <Button variant="outline" asChild>
            <Link to="/settings/data-model">Change the data model</Link>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-semibold">Your objects</h2>
          {custom.length ? (
            <ObjectLinks objects={custom} />
          ) : (
            <p className="text-sm text-muted-foreground">
              None yet. An admin can add objects such as projects, properties or
              subscriptions in the data model.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-semibold">Built in</h2>
          <ObjectLinks objects={standard} />
        </CardContent>
      </Card>
    </div>
  );
};
