import { useQuery } from "@tanstack/react-query";

import { crmApi } from "./api";
import type { AutomationInfo, Mailbox } from "./types";

export const automationInfoKey = ["crm", "automation-info"];
export const mailboxesKey = ["crm", "mailboxes"];

export const useAutomationInfo = () =>
  useQuery({
    queryKey: automationInfoKey,
    queryFn: () => crmApi<AutomationInfo>("/automation/info"),
    staleTime: 60_000,
  });

export const useMailboxes = () =>
  useQuery({
    queryKey: mailboxesKey,
    queryFn: () =>
      crmApi<{ mine: Mailbox | null; shared: Mailbox | null }>(
        "/mail/mailboxes",
      ),
  });
