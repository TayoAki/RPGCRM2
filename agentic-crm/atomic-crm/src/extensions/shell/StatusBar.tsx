import { useIsFetching } from "@tanstack/react-query";
import { useRefresh } from "ra-core";
import { CircleAlert, CircleCheck, RotateCw } from "lucide-react";
import { Link } from "react-router";

import { useAutomationInfo } from "../queries";

const Status = ({
  ok,
  label,
  fix,
  to,
}: {
  ok: boolean;
  label: string;
  fix: string;
  to?: string;
}) => {
  const Icon = ok ? CircleCheck : CircleAlert;
  const text = (
    <span className="flex items-center gap-1">
      <Icon
        className={ok ? "size-3.5 text-green-600" : "size-3.5 text-amber-600"}
      />
      {ok ? label : fix}
    </span>
  );
  return !ok && to ? (
    <Link to={to} className="hover:underline">
      {text}
    </Link>
  ) : (
    text
  );
};

/** A thin bar under everything: whether the data is fresh, and whether the assistant and mail are ready. */
export const StatusBar = () => {
  const fetching = useIsFetching();
  const refresh = useRefresh();
  const { data: info } = useAutomationInfo();
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t bg-secondary/60 px-3 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={refresh}
        className="flex items-center gap-1 hover:text-foreground"
        aria-label="Refresh"
      >
        <RotateCw className={fetching ? "size-3.5 animate-spin" : "size-3.5"} />
        {fetching ? "Updating" : "Up to date"}
      </button>
      <span className="ml-auto flex items-center gap-4">
        {info ? (
          <>
            <Status
              ok={info.ready.model}
              label="Assistant ready"
              fix="Assistant needs a model key"
            />
            <Status
              ok={info.ready.mailbox}
              label="Mailbox connected"
              fix="Connect a mailbox"
              to="/profile"
            />
          </>
        ) : null}
        <span className="hidden md:inline">Ctrl K to search</span>
      </span>
    </footer>
  );
};
