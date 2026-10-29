import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type CrmSearchResult, crmSearchQueryOptions } from "@/lib/crm/queries";

const RESULT_PATH: Record<string, string> = {
  contacts: "contacts",
  companies: "companies",
  deals: "deals",
};

const RESULT_KIND: Record<string, string> = {
  contacts: "Contact",
  companies: "Company",
  deals: "Deal",
};

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const navigate = useNavigate();
  const results = useQuery(crmSearchQueryOptions(text));
  const go = (result: CrmSearchResult) => {
    onOpenChange(false);
    setText("");
    void navigate({
      to: "/crm/$",
      params: {
        _splat: `${RESULT_PATH[result.resource]}/${result.record_id}/show`,
      },
    });
  };
  let body: ReactNode = (
    <p className="type-sub px-2 py-6 text-center text-duet-ink-2">
      Find contacts, companies and deals.
    </p>
  );
  if (text.trim().length > 1 && results.data) {
    body = results.data.length ? (
      <ul className="flex flex-col gap-0.5">
        {results.data.map((result) => (
          <li key={`${result.resource}-${result.record_id}`}>
            <button
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-duet-tile focus-visible:bg-duet-tile focus-visible:outline-none"
              onClick={() => go(result)}
              type="button"
            >
              <span className="type-caption w-16 shrink-0 text-duet-ink-3">
                {RESULT_KIND[result.resource]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-label block truncate text-duet-ink">
                  {result.title || "Untitled"}
                </span>
                {result.subtitle ? (
                  <span className="type-caption block truncate text-duet-ink-2">
                    {result.subtitle}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="type-sub px-2 py-6 text-center text-duet-ink-2">
        Nothing matches "{text.trim()}".
      </p>
    );
  }
  if (results.isError) {
    body = (
      <p className="type-sub px-2 py-6 text-center text-duet-red" role="alert">
        Couldn't search the CRM. Try again.
      </p>
    );
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="top-[20%] max-w-lg translate-y-0 p-3">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Input
          aria-label="Search the CRM"
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            const first = results.data?.[0];
            if (event.key === "Enter" && first) go(first);
          }}
          placeholder="Search contacts, companies and deals"
          value={text}
        />
        <div className="mt-2 max-h-80 overflow-y-auto">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
