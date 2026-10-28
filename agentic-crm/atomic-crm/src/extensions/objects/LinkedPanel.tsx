import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { crmApi } from "../api";
import { recordPath, titleOf, useMetadata } from "./model";

type LinkedGroup = {
  object: string;
  field: string;
  label: string;
  total: number;
  data: Record<string, unknown>[];
};

/** Custom records whose relation fields point at this record. Nothing is shown when there are none. */
export const LinkedPanel = ({
  object,
  id,
}: {
  object: string;
  id: unknown;
}) => {
  const { data: metadata } = useMetadata();
  const { data: groups = [] } = useQuery({
    queryKey: ["crm", "linked", object, String(id)],
    queryFn: () => crmApi<LinkedGroup[]>(`/linked/${object}/${id}`),
  });
  const filled = groups.filter((group) => group.total > 0);
  if (!filled.length) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="font-semibold">Linked records</h2>
        {filled.map((group) => {
          const target = metadata?.objects.find(
            (each) => each.name === group.object,
          );
          return (
            <section
              key={`${group.object}.${group.field}`}
              className="flex flex-col gap-1 text-sm"
            >
              <h3 className="font-medium">
                {target?.label_plural ?? group.object}
                <span className="text-muted-foreground">
                  {" "}
                  by {group.label.toLowerCase()} ({group.total})
                </span>
              </h3>
              <ul className="flex flex-col gap-1">
                {group.data.map((record) => (
                  <li key={String(record.id)}>
                    <Link
                      to={recordPath(group.object, record.id)}
                      className="underline-offset-2 hover:underline"
                    >
                      {titleOf(group.object, record)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
};
