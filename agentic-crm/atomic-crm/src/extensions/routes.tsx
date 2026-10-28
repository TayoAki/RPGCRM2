import { Route } from "react-router";

import { AutomationEditor } from "./automations/AutomationEditor";
import { AutomationsPage } from "./automations/AutomationsPage";
import { RunsPage } from "./automations/RunsPage";
import { DashboardPage } from "./dashboards/DashboardPage";
import { DashboardsPage } from "./dashboards/DashboardsPage";
import { MeetingsPage } from "./meetings/MeetingsPage";
import { useAccess, useMetadata } from "./objects/model";
import { ObjectListPage } from "./objects/ObjectListPage";
import { ObjectsIndex } from "./objects/ObjectsIndex";
import { RecordPage } from "./objects/RecordPage";
import { ApiKeysPage } from "./settings/ApiKeysPage";
import { DataModelPage } from "./settings/DataModelPage";
import { RolesPage } from "./settings/RolesPage";

/** The pages this fork adds to the CRM, inside its layout. */
export const EXTENSION_ROUTES = [
  <Route key="meetings" path="/meetings" element={<MeetingsPage />} />,
  <Route key="automations" path="/automations" element={<AutomationsPage />} />,
  <Route
    key="automation"
    path="/automations/:id"
    element={<AutomationEditor />}
  />,
  <Route key="runs" path="/automations/:id/runs" element={<RunsPage />} />,
  <Route key="objects" path="/o" element={<ObjectsIndex />} />,
  <Route key="object" path="/o/:object" element={<ObjectListPage />} />,
  <Route key="record" path="/o/:object/:id" element={<RecordPage />} />,
  <Route
    key="data-model"
    path="/settings/data-model"
    element={<DataModelPage />}
  />,
  <Route key="roles" path="/settings/roles" element={<RolesPage />} />,
  <Route key="api-keys" path="/settings/api" element={<ApiKeysPage />} />,
  <Route key="reports" path="/reports" element={<DashboardsPage />} />,
  <Route key="report" path="/reports/:id" element={<DashboardPage />} />,
];

const FIXED_TABS = [
  { label: "Meetings", to: "/meetings" },
  { label: "Automations", to: "/automations" },
  { label: "Reports", to: "/reports" },
];

/**
 * Their tabs in the CRM's header, after Atomic's: custom objects shown in navigation come before
 * "Records", whose path contains theirs, so the header highlights the more specific one.
 */
export const useExtensionTabs = () => {
  const { data } = useMetadata();
  const { data: access } = useAccess();
  const objects = (data?.objects ?? []).filter(
    (object) =>
      !object.standard &&
      object.in_navigation &&
      access?.objects[object.name]?.read !== "none",
  );
  return [
    ...FIXED_TABS,
    ...objects.map((object) => ({
      label: object.label_plural,
      to: `/o/${object.name}`,
    })),
    { label: "Records", to: "/o" },
  ];
};
