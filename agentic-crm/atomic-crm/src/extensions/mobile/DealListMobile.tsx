import { useGetList, useGetMany } from "ra-core";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import MobileHeader from "../../components/atomic-crm/layout/MobileHeader";
import { MobileContent } from "../../components/atomic-crm/layout/MobileContent";
import { useConfigurationContext } from "../../components/atomic-crm/root/ConfigurationContext";
import type { Company, Deal } from "../../components/atomic-crm/types";

const PAGE = 25;

/** Deals on a phone: the open ones, newest change first, narrowed to a stage with one tap. */
export const DealListMobile = () => {
  const { dealStages, currency } = useConfigurationContext();
  const [stage, setStage] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(PAGE);
  const filter = useMemo(
    () => ({ "archived_at@is": null, ...(stage ? { stage } : {}) }),
    [stage],
  );
  const {
    data: deals = [],
    total = 0,
    isPending,
  } = useGetList<Deal>("deals", {
    filter,
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage },
  });
  const companyIds = useMemo(
    () => [...new Set(deals.map((deal) => deal.company_id).filter(Boolean))],
    [deals],
  );
  const { data: companies = [] } = useGetMany<Company>("companies", {
    ids: companyIds,
  });
  const money = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const stageLabel = (value: string) =>
    dealStages.find((each) => each.value === value)?.label ?? value;

  return (
    <div>
      <MobileHeader showRefresh>
        <h1 className="text-xl font-semibold">Deals</h1>
      </MobileHeader>
      <MobileContent>
        <div
          role="group"
          aria-label="Stage"
          className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {[{ value: null, label: "All" }, ...dealStages].map((each) => (
            <Button
              key={each.value ?? "all"}
              size="sm"
              variant={stage === each.value ? "default" : "outline"}
              aria-pressed={stage === each.value}
              className="shrink-0 rounded-full"
              onClick={() => {
                setStage(each.value);
                setPerPage(PAGE);
              }}
            >
              {each.label}
            </Button>
          ))}
        </div>
        {!isPending && deals.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No deals {stage ? `in ${stageLabel(stage)}` : "yet"}.
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {deals.map((deal) => (
            <li key={deal.id}>
              <Link
                to={`/deals/${deal.id}/show`}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border bg-card p-3",
                  "active:bg-muted",
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium">{deal.name}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {stageLabel(deal.stage)}
                  </Badge>
                </span>
                <span className="flex justify-between text-sm text-muted-foreground">
                  <span className="truncate">
                    {companies.find((company) => company.id === deal.company_id)
                      ?.name ?? ""}
                  </span>
                  {deal.amount ? (
                    <span className="tabular-nums">
                      {money.format(deal.amount)}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {deals.length < total ? (
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => setPerPage(perPage + PAGE)}
          >
            Show more
          </Button>
        ) : null}
      </MobileContent>
    </div>
  );
};
