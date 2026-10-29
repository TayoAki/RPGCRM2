import type { Config } from "./config";
import type { RailwayIds, Workspace, WorkspaceStore } from "./db";
import type { Placement } from "./railway";
import { decrypt, hmacHex, randomBase64, randomHex } from "./secrets";

const START_TIMEOUT_MS = 20 * 60 * 1000;
const CHECK_EVERY_MS = 15_000;

export const STEPS = [
  { key: "project", label: "Creating your workspace" },
  { key: "database", label: "Setting up your database" },
  { key: "app", label: "Configuring your CRM" },
  { key: "building", label: "Starting your CRM" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

/** What provisioning needs from a host. Railway in production; a fake in tests. */
export type Provisioner = {
  createProject(slug: string): Promise<Placement>;
  createDatabaseService(placement: Placement, password: string): Promise<string>;
  addDatabaseVolume(placement: Placement, serviceId: string): Promise<void>;
  createAppService(placement: Placement): Promise<string>;
  configureApp(placement: Placement, serviceId: string, image: string): Promise<void>;
  setImage(placement: Placement, serviceId: string, image: string): Promise<void>;
  addDomain(placement: Placement, serviceId: string, slug: string): Promise<string>;
  setVariables(placement: Placement, serviceId: string, variables: Record<string, string>): Promise<void>;
  deploy(placement: Placement, serviceId: string): Promise<void>;
};

export type Probe = (url: string) => Promise<boolean>;

export const isLive: Probe = (url) =>
  fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) }).then(
    (response) => response.ok,
    () => false,
  );

/**
 * What every workspace gets from the operator, kept in step on running workspaces by rollout().
 * Workspaces share one Intelligence project, so each names its own threads and none adopts the
 * project's Learning container, which would carry one client's learned skills into another's.
 */
export function fleetVariables(
  workspace: Workspace,
  shared: Record<string, string>,
): Record<string, string> {
  return {
    DEPLOYMENT_ID: `magpie-${workspace.slug}`,
    OPENBOT_LEARNING_AUTO_ASSIGN: "false",
    ...shared,
  };
}

const fingerprintOf = (secret: string, variables: Record<string, string>) =>
  hmacHex(secret, JSON.stringify(Object.entries(variables).sort()));

/** Everything a new workspace's app needs. */
export function appVariables(input: {
  workspace: Workspace;
  setupToken: string;
  databasePassword: string;
  domain: string;
  shared: Record<string, string>;
}): Record<string, string> {
  const url = `https://${input.domain}`;
  return {
    PORT: "3001",
    DATABASE_URL: `postgres://crm:${input.databasePassword}@\${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/crm`,
    OPENBOT_PUBLIC_URL: url,
    BETTER_AUTH_URL: url,
    TRUSTED_ORIGINS: url,
    APP_PUBLIC_URL: url,
    BETTER_AUTH_SECRET: randomBase64(),
    KEY_ENCRYPTION_KEY: randomBase64(),
    AGENT_TOOL_TOKEN: randomHex(),
    SIGNIN_EMAIL_PASSWORD: "true",
    INITIAL_ADMIN_EMAILS: input.workspace.owner_email,
    WORKSPACE_OWNER_EMAIL: input.workspace.owner_email,
    WORKSPACE_OWNER_NAME: input.workspace.owner_name,
    WORKSPACE_SETUP_TOKEN: input.setupToken,
    OPENBOT_SELF_HOST_BANNER: "false",
    COPILOTKIT_TELEMETRY_DISABLED: "true",
    INTELLIGENCE_API_URL: "https://api.intelligence.copilotkit.ai",
    INTELLIGENCE_GATEWAY_WS_URL: "wss://realtime.intelligence.copilotkit.ai",
    // The app refuses to start without one; the assistant stays off until a real key is set.
    INTELLIGENCE_API_KEY: "not-configured",
    ...fleetVariables(input.workspace, input.shared),
  };
}

/**
 * Takes each new workspace from a sign-up to a running CRM, one step at a time. Every step records
 * what it made before the next starts, so a restart picks up where it stopped instead of making a
 * second project.
 */
export function createProvisioning(deps: {
  config: Config;
  store: WorkspaceStore;
  provisioner?: Provisioner;
  probe?: Probe;
  sleep?: (ms: number) => Promise<void>;
  startTimeoutMs?: number;
}) {
  const running = new Set<string>();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const probe = deps.probe ?? isLive;

  async function provision(workspace: Workspace): Promise<void> {
    const provisioner = deps.provisioner;
    if (!provisioner) {
      await deps.store.update(workspace.id, {
        status: "queued",
        step: "waiting",
        error: "Your workspace is in the queue and will start shortly. You can leave this page.",
      });
      return;
    }
    const ids: RailwayIds = { ...workspace.railway };
    const image = deps.config.railway?.image ?? "";
    const save = async (step: StepKey, found: RailwayIds = {}) => {
      Object.assign(ids, found);
      await deps.store.update(workspace.id, {
        status: "provisioning",
        step,
        error: null,
        railway: found,
      });
    };

    await save("project");
    if (!ids.projectId || !ids.environmentId) {
      await save("project", await provisioner.createProject(workspace.slug));
    }
    const placement = {
      projectId: ids.projectId as string,
      environmentId: ids.environmentId as string,
    };
    // Derived rather than stored, so a restart between steps uses the same password.
    const databasePassword = hmacHex(deps.config.secret, `database:${workspace.id}`);

    await save("database");
    if (!ids.databaseServiceId) {
      await save("database", {
        databaseServiceId: await provisioner.createDatabaseService(placement, databasePassword),
      });
    }
    if (!ids.databaseVolume) {
      await provisioner.addDatabaseVolume(placement, ids.databaseServiceId as string);
      await save("database", { databaseVolume: true });
    }

    await save("app");
    if (!ids.appServiceId) {
      await save("app", { appServiceId: await provisioner.createAppService(placement) });
    }
    const appServiceId = ids.appServiceId as string;
    if (!ids.appConfigured) {
      await provisioner.configureApp(placement, appServiceId, image);
      await save("app", { appConfigured: true, image });
    }
    if (!ids.domain) {
      await save("app", {
        domain: await provisioner.addDomain(placement, appServiceId, workspace.slug),
      });
    }
    if (!ids.variablesSet) {
      await provisioner.setVariables(
        placement,
        appServiceId,
        appVariables({
          workspace,
          setupToken: decrypt(deps.config.secret, workspace.setup_token_sealed),
          databasePassword,
          domain: ids.domain as string,
          shared: deps.config.sharedWorkspaceVariables,
        }),
      );
      await save("app", {
        variablesSet: true,
        fleet: fingerprintOf(
          deps.config.secret,
          fleetVariables(workspace, deps.config.sharedWorkspaceVariables),
        ),
      });
    }
    if (!ids.deployStarted) {
      await provisioner.deploy(placement, appServiceId);
      await save("app", { deployStarted: true });
    }

    await save("building");
    const url = `https://${ids.domain}`;
    const deadline = Date.now() + (deps.startTimeoutMs ?? START_TIMEOUT_MS);
    while (!(await probe(url))) {
      if (Date.now() > deadline) {
        throw new Error("Your CRM didn't come up in time. We've been told and will finish it for you.");
      }
      await sleep(CHECK_EVERY_MS);
    }
    await deps.store.update(workspace.id, {
      status: "ready",
      step: null,
      error: null,
      app_url: url,
      ready: true,
    });
  }

  return {
    /** Starts provisioning a workspace in the background, unless it's already under way. */
    start(id: string): Promise<void> {
      if (running.has(id)) return Promise.resolve();
      running.add(id);
      return (async () => {
        try {
          const workspace = await deps.store.get(id);
          if (workspace && workspace.status !== "ready") await provision(workspace);
        } catch (error) {
          console.error(JSON.stringify({ type: "provisioning-failed", id, error: String(error) }));
          await deps.store.update(id, {
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          running.delete(id);
        }
      })();
    },
    async resume(): Promise<void> {
      for (const workspace of await deps.store.unfinished()) void this.start(workspace.id);
    },

    /**
     * Brings running workspaces up to the configured image and shared settings, one at a time.
     * Changing WORKSPACE_IMAGE or a shared key on this service is how it reaches existing customers.
     */
    async rollout(): Promise<void> {
      const provisioner = deps.provisioner;
      const image = deps.config.railway?.image;
      if (!provisioner || !image) return;
      for (const workspace of await deps.store.ready()) {
        const { environmentId, projectId, appServiceId } = workspace.railway;
        if (!environmentId || !projectId || !appServiceId) continue;
        const variables = fleetVariables(workspace, deps.config.sharedWorkspaceVariables);
        const fleet = fingerprintOf(deps.config.secret, variables);
        const newImage = workspace.railway.image !== image;
        const newSettings = workspace.railway.fleet !== fleet;
        if (!newImage && !newSettings) continue;
        try {
          const placement = { projectId, environmentId };
          if (newSettings) await provisioner.setVariables(placement, appServiceId, variables);
          if (newImage) await provisioner.setImage(placement, appServiceId, image);
          await provisioner.deploy(placement, appServiceId);
          await deps.store.update(workspace.id, { railway: { image, fleet } });
        } catch (error) {
          console.error(
            JSON.stringify({ type: "rollout-failed", id: workspace.id, error: String(error) }),
          );
        }
      }
    },
  };
}

export type Provisioning = ReturnType<typeof createProvisioning>;
