import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { workPlanKeys } from "./queries";

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Turns one job on, as a routine of the person, in their own time zone. */
export const turnJobOnMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) =>
      client(`/api/work-plan/items/${encodeURIComponent(id)}`, {
        method: "POST",
        body: { timezone: timezone() },
        fallback: "Couldn't turn this job on. Try again.",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workPlanKeys.all }),
  });

export const turnJobOffMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) =>
      client(`/api/work-plan/items/${encodeURIComponent(id)}`, {
        method: "DELETE",
        fallback: "Couldn't turn this job off. Try again.",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workPlanKeys.all }),
  });

export const turnPlanOnMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: () =>
      client("/api/work-plan/on", {
        method: "POST",
        body: { timezone: timezone() },
        fallback: "Couldn't turn the plan on. Try again.",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workPlanKeys.all }),
  });
