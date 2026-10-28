import { Route } from "react-router";

import { AutomationEditor } from "./automations/AutomationEditor";
import { AutomationsPage } from "./automations/AutomationsPage";
import { RunsPage } from "./automations/RunsPage";
import { DashboardPage } from "./dashboards/DashboardPage";
import { DashboardsPage } from "./dashboards/DashboardsPage";
import { MeetingsPage } from "./meetings/MeetingsPage";
import { ObjectListPage } from "./objects/ObjectListPage";
import { ObjectsIndex } from "./objects/ObjectsIndex";
import { RecordPage } from "./objects/RecordPage";
import { ApiKeysPage } from "./settings/ApiKeysPage";
import { DataModelPage } from "./settings/DataModelPage";
import { RolesPage } from "./settings/RolesPage";
import { SignInPage } from "./settings/SignInPage";

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
  <Route key="sign-in" path="/settings/sign-in" element={<SignInPage />} />,
  <Route key="reports" path="/reports" element={<DashboardsPage />} />,
  <Route key="report" path="/reports/:id" element={<DashboardPage />} />,
];
