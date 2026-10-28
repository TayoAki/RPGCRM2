import { Route } from "react-router";

import { AutomationEditor } from "./automations/AutomationEditor";
import { AutomationsPage } from "./automations/AutomationsPage";
import { RunsPage } from "./automations/RunsPage";
import { MeetingsPage } from "./meetings/MeetingsPage";

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
];

/** Their tabs in the CRM's header, after Atomic's. */
export const EXTENSION_TABS = [
  { label: "Meetings", to: "/meetings" },
  { label: "Automations", to: "/automations" },
];
