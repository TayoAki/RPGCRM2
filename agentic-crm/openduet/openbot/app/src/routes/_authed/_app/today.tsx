import { createFileRoute } from "@tanstack/react-router";
import { TodayScreen, type TodayView } from "@/components/today/today-screen";

export const Route = createFileRoute("/_authed/_app/today")({
  validateSearch: (search: Record<string, unknown>): { view?: TodayView } =>
    search.view === "mine" || search.view === "team"
      ? { view: search.view }
      : {},
  component: TodayRoute,
});

function TodayRoute() {
  const { view } = Route.useSearch();
  return <TodayScreen view={view ?? "overview"} />;
}
