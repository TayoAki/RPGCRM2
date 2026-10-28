import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ProposalPage = lazy(() =>
  import("atomic-crm/proposal").then((module) => ({
    default: module.ProposalPage,
  })),
);

// A client's proposal, opened from the link in their email. No sign-in.
export const Route = createFileRoute("/proposal/$token")({
  component: ProposalScreen,
});

function ProposalScreen() {
  const { token } = Route.useParams();
  return (
    <Suspense fallback={null}>
      <ProposalPage token={token} />
    </Suspense>
  );
}
