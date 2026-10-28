import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useCallback } from "react";
import { usePageChrome } from "@/components/shell/page-chrome";
import { useTheme } from "@/components/theme-provider";
import { signOutMutationOptions } from "@/lib/auth/mutations";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";
import { queryClient } from "@/query-client";
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
          theme={resolved}
          user={user}
        />
      </Suspense>
    </div>
  );
}
