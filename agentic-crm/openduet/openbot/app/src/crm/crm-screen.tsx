import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { CrmRecordRef } from "atomic-crm/embed";
import { lazy, Suspense, useCallback, useState } from "react";
import { NewTaskSheet } from "@/components/shell/new-task-sheet";
import { usePageChrome } from "@/components/shell/page-chrome";
import { useTheme } from "@/components/theme-provider";
import { signOutMutationOptions } from "@/lib/auth/mutations";
import { primaryBot } from "@/lib/agents/primary-bot";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";
import { queryClient } from "@/query-client";
import { askAgentContext } from "./ask-agent";
import "./crm-screen.css";

const CrmEmbed = lazy(() =>
  import("atomic-crm/embed").then((module) => ({ default: module.CrmEmbed })),
);

const CRM_BASENAME = "/crm";

/*
 * Not a PageShell screen: the CRM is a whole app of tables and boards with its own navigation, so it
 * takes the page's full width and scrolls on its own. The top padding clears the floating page
 * header, as PageShell's does.
 */
export function CrmScreen() {
  usePageChrome({ title: "CRM" });
  const { history } = useRouter();
  const { resolved } = useTheme();
  const navigate = useNavigate();
  const { data: user } = useQuery(currentUserQueryOptions());
  const { data: capabilities } = useQuery(deploymentCapabilitiesQueryOptions());
  const bot = primaryBot(useQuery(agentListQueryOptions()).data);
  const [asking, setAsking] = useState<CrmRecordRef | null>(null);
  const { mutateAsync: signOut } = useMutation(
    signOutMutationOptions(queryClient),
  );
  const signOutAndLeave = useCallback(async () => {
    await signOut();
    await navigate({ to: "/sign" });
  }, [signOut, navigate]);

  if (!user) return null;

  return (
    <div className="crm-screen min-h-0 flex-1 overflow-y-auto bg-background pt-[92px] text-foreground">
      <Suspense fallback={null}>
        <CrmEmbed
          basename={CRM_BASENAME}
          history={history}
          onSignOut={
            capabilities?.localEvaluation === false
              ? signOutAndLeave
              : undefined
          }
          onAskAgent={bot ? setAsking : undefined}
          theme={resolved}
          user={user}
        />
      </Suspense>
      {asking && bot ? (
        <NewTaskSheet
          bot={bot}
          instructionPrefix={askAgentContext(asking)}
          onAdded={(where, task) => {
            setAsking(null);
            void (where === "active" && task
              ? navigate({ to: "/tasks/$taskId", params: { taskId: task.id } })
              : navigate({ to: "/tasks" }));
          }}
          onClose={() => setAsking(null)}
          question={`What should ${bot.name} do about ${asking.title || "this"}?`}
        />
      ) : null}
    </div>
  );
}
