import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export type Database = postgres.Sql;

export type WorkspaceStatus = "queued" | "provisioning" | "ready" | "failed";

export type RailwayIds = {
  projectId?: string;
  environmentId?: string;
  databaseServiceId?: string;
  databaseVolume?: boolean;
  appServiceId?: string;
  appConfigured?: boolean;
  domain?: string;
  variablesSet?: boolean;
  deployStarted?: boolean;
  image?: string;
  fleet?: string;
};

export type Workspace = {
  id: string;
  slug: string;
  company: string;
  owner_name: string;
  owner_email: string;
  status: WorkspaceStatus;
  step: string | null;
  error: string | null;
  claim_hash: string;
  setup_token_sealed: string;
  railway: RailwayIds;
  app_url: string | null;
  created_at: Date;
  ready_at: Date | null;
};

const MIGRATIONS = join(import.meta.dir, "..", "migrations");

export function connect(url: string, max = 5): Database {
  return postgres(url, { max, onnotice: () => {} });
}

export async function migrate(sql: Database): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS platform`;
  await sql`CREATE TABLE IF NOT EXISTS platform.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM platform.migrations`).map(
      (row) => row.name,
    ),
  );
  for (const name of readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql")).sort()) {
    if (applied.has(name)) continue;
    await sql.begin(async (transaction) => {
      await transaction.unsafe(readFileSync(join(MIGRATIONS, name), "utf8"));
      await transaction`INSERT INTO platform.migrations (name) VALUES (${name})`;
    });
  }
}

export function createWorkspaceStore(sql: Database) {
  return {
    async create(input: {
      slug: string;
      company: string;
      ownerName: string;
      ownerEmail: string;
      claimHash: string;
      setupTokenSealed: string;
    }): Promise<Workspace> {
      const [row] = await sql<Workspace[]>`
        INSERT INTO platform.workspaces (slug, company, owner_name, owner_email, claim_hash, setup_token_sealed)
        VALUES (${input.slug}, ${input.company}, ${input.ownerName}, ${input.ownerEmail}, ${input.claimHash}, ${input.setupTokenSealed})
        RETURNING *`;
      if (!row) throw new Error("Could not create the workspace.");
      return row;
    },
    async get(id: string): Promise<Workspace | undefined> {
      const [row] = await sql<Workspace[]>`SELECT * FROM platform.workspaces WHERE id = ${id}`;
      return row;
    },
    async bySlug(slug: string): Promise<Workspace | undefined> {
      const [row] = await sql<Workspace[]>`SELECT * FROM platform.workspaces WHERE slug = ${slug}`;
      return row;
    },
    async count(): Promise<number> {
      const [row] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM platform.workspaces`;
      return row?.count ?? 0;
    },
    async ready(): Promise<Workspace[]> {
      return sql<Workspace[]>`SELECT * FROM platform.workspaces WHERE status = 'ready' ORDER BY created_at`;
    },
    async unfinished(): Promise<Workspace[]> {
      return sql<Workspace[]>`SELECT * FROM platform.workspaces WHERE status IN ('queued', 'provisioning') ORDER BY created_at`;
    },
    async update(
      id: string,
      patch: Partial<Pick<Workspace, "status" | "step" | "error" | "app_url" | "railway">> & {
        ready?: boolean;
      },
    ): Promise<void> {
      const { ready, railway, ...fields } = patch;
      if (Object.keys(fields).length) {
        await sql`UPDATE platform.workspaces SET ${sql(fields)}, updated_at = now() WHERE id = ${id}`;
      }
      if (railway) {
        await sql`UPDATE platform.workspaces SET railway = railway || ${sql.json(railway as postgres.JSONValue)}, updated_at = now() WHERE id = ${id}`;
      }
      if (ready) {
        await sql`UPDATE platform.workspaces SET ready_at = now() WHERE id = ${id}`;
      }
    },
  };
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
