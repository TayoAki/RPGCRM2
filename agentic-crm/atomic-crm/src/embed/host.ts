import { createContext, useContext } from "react";

export type CrmRecordRef = {
  resource: "contacts" | "companies" | "deals";
  id: number;
  title: string;
};

export type CrmHost = {
  onAskAgent?: (record: CrmRecordRef) => void;
  // The host draws the rail, sidebar and status bar; the CRM draws only its tabs and page.
  hostFrame?: boolean;
};

// Set only when the CRM runs inside a host app; Atomic on its own has none.
export const HostContext = createContext<CrmHost | null>(null);

export const useHost = () => useContext(HostContext);
