import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanAccess, useGetIdentity, useNotify } from "ra-core";
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";

import { crmApi, errorMessage } from "../api";
import type { Dashboard, Widget } from "../types";
import { dashboardsKey } from "./report";
import { WidgetDialog } from "./WidgetDialog";
import { WidgetView } from "./WidgetView";

/** A report's charts in a grid; its owner, or an admin, adds, changes and removes them. */
export const DashboardPage = () => {
  const { id = "" } = useParams();
  const key = [...dashboardsKey, id];
  const { data: dashboard, error } = useQuery({
    queryKey: key,
    queryFn: () => crmApi<Dashboard>(`/dashboards/${id}`),
  });
  const { identity } = useGetIdentity();
  const { canAccess: isAdmin = false } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const [editing, setEditing] = useState<Widget | "new" | null>(null);
  const notify = useNotify();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (error) {
    return (
      <p className="mt-4 text-muted-foreground">This report isn't here.</p>
    );
  }
  if (!dashboard) return null;
  const canChange = isAdmin || dashboard.sales_id === identity?.id;

  const save = async (change: Partial<Dashboard>) => {
    try {
      const updated = await crmApi<Dashboard>(`/dashboards/${dashboard.id}`, {
        method: "PUT",
        body: change,
      });
      queryClient.setQueryData(key, updated);
      await queryClient.invalidateQueries({
        queryKey: dashboardsKey,
        exact: true,
      });
    } catch (failure) {
      notify(errorMessage(failure), { type: "error" });
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the report "${dashboard.name}"?`)) return;
    try {
      await crmApi(`/dashboards/${dashboard.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: dashboardsKey });
      navigate("/reports");
    } catch (failure) {
      notify(errorMessage(failure), { type: "error" });
    }
  };
  const saveWidget = (widget: Widget) => {
    const exists = dashboard.widgets.some((each) => each.id === widget.id);
    setEditing(null);
    void save({
      widgets: exists
        ? dashboard.widgets.map((each) =>
            each.id === widget.id ? widget : each,
          )
        : [...dashboard.widgets, widget],
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/reports" aria-label="All reports">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{dashboard.name}</h1>
        </div>
        {canChange ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={remove}>
              Delete
            </Button>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Add a chart
            </Button>
          </div>
        ) : null}
      </div>
      {dashboard.widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No charts yet.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {dashboard.widgets.map((widget) => (
          <WidgetView
            key={widget.id}
            widget={widget}
            {...(canChange
              ? {
                  onEdit: () => setEditing(widget),
                  onRemove: () =>
                    void save({
                      widgets: dashboard.widgets.filter(
                        (each) => each.id !== widget.id,
                      ),
                    }),
                }
              : {})}
          />
        ))}
      </div>
      {editing ? (
        <WidgetDialog
          widget={editing === "new" ? undefined : editing}
          onSave={saveWidget}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
};
