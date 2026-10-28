import { Sparkles } from "lucide-react";
import { useRecordContext, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { type CrmRecordRef, useHost } from "./host";

type Named = {
  id: number;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
};

const titleOf = (record: Named) =>
  record.name ??
  [record.first_name, record.last_name].filter(Boolean).join(" ");

export const AskAgentButton = ({
  resource,
}: {
  resource: CrmRecordRef["resource"];
}) => {
  const ask = useHost()?.onAskAgent;
  const record = useRecordContext<Named>();
  const translate = useTranslate();
  if (!ask || !record) return null;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => ask({ resource, id: record.id, title: titleOf(record) })}
    >
      <Sparkles />
      {translate("crm.ask_agent", { _: "Ask the agent" })}
    </Button>
  );
};
