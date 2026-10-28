import { useGetIdentity, useGetList } from "ra-core";
import { useMemo } from "react";

export const SHOWN = 8;

type Task = {
  id: number;
  text: string;
  due_date: string;
  contact_id: number;
  done_date: string | null;
};

const endOfToday = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
};

/** The person's tasks due today or late, for the rail's count and the panel. */
export const useDueTasks = () => {
  const { identity } = useGetIdentity();
  const filter = useMemo(
    () => ({
      sales_id: identity?.id,
      "done_date@is": null,
      "due_date@lte": endOfToday(),
    }),
    [identity?.id],
  );
  return useGetList<Task>(
    "tasks",
    {
      filter,
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: SHOWN },
    },
    { enabled: identity?.id != null },
  );
};
