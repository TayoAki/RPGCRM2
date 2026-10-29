// Variables copied into every workspace, so they share the operator's model and Intelligence keys.
const SHARED_WORKSPACE_VARIABLES = [
  "OPENAI_API_KEY",
  "INTELLIGENCE_API_KEY",
  "INTELLIGENCE_API_URL",
  "INTELLIGENCE_GATEWAY_WS_URL",
  "COPILOTKIT_LICENSE_TOKEN",
  "COMPOSIO_API_KEY",
] as const;

export type RailwaySettings = {
  token: string;
  workspaceId?: string;
  image: string;
};

export type Config = {
  port: number;
  databaseUrl: string;
  publicUrl: string;
  secret: string;
  maxWorkspaces: number;
  railway?: RailwaySettings;
  sharedWorkspaceVariables: Record<string, string>;
};

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is required.`);
    return value;
  };
  const secret = required("PLATFORM_SECRET");
  if (secret.length < 32) {
    throw new Error("PLATFORM_SECRET must be at least 32 characters.");
  }
  const token = env.RAILWAY_API_TOKEN?.trim();
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: required("DATABASE_URL"),
    publicUrl: (env.PUBLIC_URL?.trim() || `http://localhost:${env.PORT ?? 3000}`).replace(/\/$/, ""),
    secret,
    maxWorkspaces: Number(env.MAX_WORKSPACES ?? 50),
    ...(token
      ? {
          railway: {
            token,
            workspaceId: env.RAILWAY_WORKSPACE_ID?.trim() || undefined,
            image: env.WORKSPACE_IMAGE?.trim() || "ghcr.io/tayoaki/magpie-crm:edge",
          },
        }
      : {}),
    sharedWorkspaceVariables: Object.fromEntries(
      SHARED_WORKSPACE_VARIABLES.flatMap((name) => {
        const value = env[name]?.trim();
        return value ? [[name, value]] : [];
      }),
    ),
  };
}
