import type { RailwaySettings } from "./config";

const API = "https://backboard.railway.com/graphql/v2";

export const DATABASE_IMAGE = "pgvector/pgvector:pg18";
const DATABASE_MOUNT = "/var/lib/postgresql/data";
const APP_PORT = 3001;

// Every query the provisioner sends, checked against Railway's schema by scripts/check-railway-queries.ts.
export const QUERIES = {
  projectCreate: `mutation ($input: ProjectCreateInput!) {
    projectCreate(input: $input) { id environments { edges { node { id name } } } }
  }`,
  serviceCreate: `mutation ($input: ServiceCreateInput!) {
    serviceCreate(input: $input) { id }
  }`,
  volumeCreate: `mutation ($input: VolumeCreateInput!) {
    volumeCreate(input: $input) { id }
  }`,
  serviceInstanceUpdate: `mutation ($serviceId: String!, $environmentId: String, $input: ServiceInstanceUpdateInput!) {
    serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
  }`,
  serviceDomainCreate: `mutation ($input: ServiceDomainCreateInput!) {
    serviceDomainCreate(input: $input) { id domain }
  }`,
  serviceDomainUpdate: `mutation ($input: ServiceDomainUpdateInput!) {
    serviceDomainUpdate(input: $input)
  }`,
  variableCollectionUpsert: `mutation ($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`,
  serviceInstanceDeployV2: `mutation ($serviceId: String!, $environmentId: String!) {
    serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
  }`,
} as const;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export type Placement = { projectId: string; environmentId: string };

export function createRailway(settings: RailwaySettings, fetcher: Fetch = fetch) {
  async function call<TData>(
    query: keyof typeof QUERIES,
    variables: Record<string, unknown>,
  ): Promise<TData> {
    const response = await fetcher(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.token}`,
      },
      body: JSON.stringify({ query: QUERIES[query], variables }),
    });
    const body = (await response.json().catch(() => null)) as {
      data?: TData;
      errors?: { message: string }[];
    } | null;
    if (!response.ok || !body?.data || body.errors?.length) {
      const reason = body?.errors?.map((error) => error.message).join("; ");
      throw new Error(`Railway ${query} failed: ${reason ?? response.status}`);
    }
    return body.data;
  }

  return {
    async createProject(slug: string): Promise<Placement> {
      const { projectCreate } = await call<{
        projectCreate: {
          id: string;
          environments: { edges: { node: { id: string; name: string } }[] };
        };
      }>("projectCreate", {
        input: {
          name: `magpie-${slug}`,
          description: `Magpie CRM workspace for ${slug}`,
          defaultEnvironmentName: "production",
          ...(settings.workspaceId ? { workspaceId: settings.workspaceId } : {}),
        },
      });
      const environment = projectCreate.environments.edges[0]?.node;
      if (!environment) throw new Error("Railway made a project with no environment.");
      return { projectId: projectCreate.id, environmentId: environment.id };
    },

    async createDatabaseService(placement: Placement, password: string): Promise<string> {
      const { serviceCreate } = await call<{ serviceCreate: { id: string } }>(
        "serviceCreate",
        {
          input: {
            ...placement,
            name: "postgres",
            source: { image: DATABASE_IMAGE },
            variables: {
              POSTGRES_USER: "crm",
              POSTGRES_DB: "crm",
              POSTGRES_PASSWORD: password,
              PGDATA: `${DATABASE_MOUNT}/pgdata`,
              // Root, so Postgres can own the freshly mounted volume.
              RAILWAY_RUN_UID: "0",
            },
          },
        },
      );
      return serviceCreate.id;
    },

    async addDatabaseVolume(placement: Placement, serviceId: string): Promise<void> {
      await call("volumeCreate", {
        input: { ...placement, serviceId, mountPath: DATABASE_MOUNT },
      });
    },

    /** The app service, without a source yet so nothing builds before it's configured. */
    async createAppService(placement: Placement): Promise<string> {
      const { serviceCreate } = await call<{ serviceCreate: { id: string } }>(
        "serviceCreate",
        { input: { ...placement, name: "app" } },
      );
      return serviceCreate.id;
    },

    async configureApp(placement: Placement, serviceId: string, image: string): Promise<void> {
      await call("serviceInstanceUpdate", {
        serviceId,
        environmentId: placement.environmentId,
        input: {
          source: { image },
          // A release that never turns healthy is not switched to; the previous one keeps serving.
          healthcheckPath: "/health",
          healthcheckTimeout: 600,
          restartPolicyType: "ON_FAILURE",
          restartPolicyMaxRetries: 3,
        },
      });
    },

    async setImage(placement: Placement, serviceId: string, image: string): Promise<void> {
      await call("serviceInstanceUpdate", {
        serviceId,
        environmentId: placement.environmentId,
        input: { source: { image } },
      });
    },

    async addDomain(placement: Placement, serviceId: string, slug: string): Promise<string> {
      const { serviceDomainCreate } = await call<{
        serviceDomainCreate: { id: string; domain: string };
      }>("serviceDomainCreate", {
        input: { serviceId, environmentId: placement.environmentId, targetPort: APP_PORT },
      });
      const wanted = `magpie-${slug}.up.railway.app`;
      return call("serviceDomainUpdate", {
        input: {
          domain: wanted,
          serviceDomainId: serviceDomainCreate.id,
          serviceId,
          environmentId: placement.environmentId,
          targetPort: APP_PORT,
        },
      }).then(
        () => wanted,
        // Taken by somebody else on Railway: keep the address Railway generated.
        () => serviceDomainCreate.domain,
      );
    },

    async setVariables(
      placement: Placement,
      serviceId: string,
      variables: Record<string, string>,
    ): Promise<void> {
      await call("variableCollectionUpsert", {
        input: { ...placement, serviceId, variables, skipDeploys: true },
      });
    },

    async deploy(placement: Placement, serviceId: string): Promise<void> {
      await call("serviceInstanceDeployV2", {
        serviceId,
        environmentId: placement.environmentId,
      });
    },
  };
}

export type Railway = ReturnType<typeof createRailway>;
