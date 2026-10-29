import type { Config } from "../src/config";
import { connect, migrate } from "../src/db";
import type { Placement } from "../src/railway";
import type { Provisioner } from "../src/provision";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://openbot:openbot@localhost:5432/openbot_test";

export async function testDatabase() {
  const sql = connect(TEST_DATABASE_URL, 2);
  await migrate(sql);
  return sql;
}

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  port: 0,
  databaseUrl: TEST_DATABASE_URL,
  publicUrl: "http://localhost",
  secret: "a-test-platform-secret-of-enough-length",
  maxWorkspaces: 1000,
  sharedWorkspaceVariables: { OPENAI_API_KEY: "sk-test" },
  ...overrides,
});

/** Records what it was asked to make, and can fail once at a named step. */
export function fakeProvisioner(failOnceAt?: keyof Provisioner) {
  const calls: string[] = [];
  const variables: Record<string, string>[] = [];
  let failed = false;
  const step = <TResult>(name: keyof Provisioner, result: TResult) => async () => {
    calls.push(name);
    if (name === failOnceAt && !failed) {
      failed = true;
      throw new Error(`${name} broke`);
    }
    return result;
  };
  const placement: Placement = { projectId: "project-1", environmentId: "environment-1" };
  const provisioner: Provisioner = {
    createProject: step("createProject", placement),
    createDatabaseService: step("createDatabaseService", "database-1"),
    addDatabaseVolume: step("addDatabaseVolume", undefined),
    createAppService: step("createAppService", "app-1"),
    configureApp: step("configureApp", undefined),
    addDomain: step("addDomain", "magpie-test.up.railway.app"),
    setVariables: async (_placement, _service, values) => {
      await step("setVariables", undefined)();
      variables.push(values);
    },
    deployFromRepo: step("deployFromRepo", undefined),
  };
  return { provisioner, calls, variables };
}
