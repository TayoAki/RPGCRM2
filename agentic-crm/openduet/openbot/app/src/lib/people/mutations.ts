import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { type Person, peopleKeys } from "./queries";

const FALLBACK = "Could not update that person";

function invalidatePeople(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: peopleKeys.all });
}

export function setPersonRoleMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (variables: {
      userId: string;
      role: "admin" | "user";
    }): Promise<Person> =>
      client(`/api/admin/people/${variables.userId}/role`, "person", {
        method: "POST",
        body: { role: variables.role },
        fallback: FALLBACK,
      }),
    onSuccess: () => invalidatePeople(queryClient),
  });
}

/**
 * Remove somebody's access, or give it back.
 *
 * One mutation rather than two, because the row is a single decision with two directions and the
 * screen renders the same control either way.
 */
export function setPersonAccessMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (variables: {
      userId: string;
      revoked: boolean;
    }): Promise<Person> =>
      client(`/api/admin/people/${variables.userId}/access`, "person", {
        method: "POST",
        body: { revoked: variables.revoked },
        fallback: FALLBACK,
      }),
    onSuccess: () => invalidatePeople(queryClient),
  });
}

/** Adds somebody who signs in with email and password. Answers the path of their set-password link. */
export function addPasswordPersonMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (variables: { email: string; name: string }): Promise<string> =>
      client("/api/admin/people", "setPasswordPath", {
        method: "POST",
        body: variables,
        fallback: "Could not add that person",
      }),
    onSuccess: () => invalidatePeople(queryClient),
  });
}

/** A new set-password link for somebody who signs in with a password. Answers its path. */
export function issuePasswordLinkMutationOptions() {
  return mutationOptions({
    mutationFn: (userId: string): Promise<string> =>
      client(`/api/admin/people/${userId}/password-link`, "setPasswordPath", {
        method: "POST",
        fallback: "Could not make a password link",
      }),
  });
}
