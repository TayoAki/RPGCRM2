import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { LayoutDashboard, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { crmApi, errorMessage } from "../api";
import type { Dashboard, Widget } from "../types";
import { dashboardsKey } from "./report";

// A new report starts with something to look at, and is changed from there.
const STARTER: Widget[] = [
  {
    id: "value",
    title: "Value of all deals",
    type: "number",
    object: "deals",
    fn: "sum",
    field: "amount",
    width: 1,
  },
  {
    id: "pipeline",
    title: "Pipeline by stage",
    type: "bar",
    object: "deals",
    fn: "sum",
    field: "amount",
    group_by: "stage",
    width: 2,
  },
  {
    id: "contacts",
    title: "New contacts per month",
    type: "line",
    object: "contacts",
    fn: "count",
    group_by: "first_seen",
    bucket: "month",
    width: 2,
  },
  {
    id: "sources",
    title: "Contacts by lead source",
    type: "bar",
    object: "contacts",
    fn: "count",
    group_by: "lead_source",
    width: 1,
  },
];

const useDashboards = () =>
  useQuery({
    queryKey: dashboardsKey,
    queryFn: () => crmApi<Dashboard[]>("/dashboards"),
  });

/** The team's reports and the person's own, and a way to start one. */
export const DashboardsPage = () => {
  const { data: dashboards = [], isPending } = useDashboards();
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const notify = useNotify();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const dashboard = await crmApi<Dashboard>("/dashboards", {
        method: "POST",
        body: { name, shared, widgets: STARTER },
      });
      await queryClient.invalidateQueries({ queryKey: dashboardsKey });
      navigate(`/reports/${dashboard.id}`);
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };

  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Numbers and charts over any records, for you or the whole team.
        </p>
      </div>
      {!isPending && dashboards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reports yet. Start one below; it comes with a few charts you can
          change.
        </p>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2">
        {dashboards.map((dashboard) => (
          <li key={dashboard.id}>
            <Link
              to={`/reports/${dashboard.id}`}
              className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted"
            >
              <LayoutDashboard className="size-5 text-muted-foreground" />
              <span>
                <span className="font-medium">{dashboard.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {dashboard.widgets.length} charts
                  {dashboard.shared ? ", shared with the team" : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Card>
        <CardContent>
          <form onSubmit={create} className="flex flex-col gap-3">
            <h2 className="font-semibold">New report</h2>
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="Report name"
                placeholder="Sales this quarter"
                className="max-w-xs"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" disabled={!name.trim()}>
                <Plus className="size-4" />
                Create
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={shared}
                onCheckedChange={(checked) => setShared(checked === true)}
              />
              Everyone on the team can see it
            </label>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
