import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { prospectingKeys } from "./queries";

/** Turn the weekly lead list on, scheduled in the person's own time zone. */
export const startWeeklyLeadsMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: () =>
      client("/api/prospecting/routine", {
        method: "POST",
        body: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        fallback: "Couldn't turn on the weekly lead list. Try again.",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: prospectingKeys.all }),
  });

export const stopWeeklyLeadsMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: () =>
      client("/api/prospecting/routine", {
        method: "DELETE",
        fallback: "Couldn't turn off the weekly lead list. Try again.",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: prospectingKeys.all }),
  });
