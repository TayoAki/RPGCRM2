import { createFileRoute } from "@tanstack/react-router";
import { CrmScreen } from "@/crm/crm-screen";

// Everything under /crm belongs to the CRM's own router, which follows this router's history.
export const Route = createFileRoute("/_authed/_app/crm/$")({
  component: CrmScreen,
});
