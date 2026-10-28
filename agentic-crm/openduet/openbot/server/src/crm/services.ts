import { hostname } from "node:os";
import type { Database } from "../db/client";
import { type Repeating, repeatAfterEach } from "../work/loop";
import type { WriteText } from "./ai";
import { type CreateTransport, createCrmMail } from "./mail";
import { createCrmInbox, type ReadInbox } from "./mail-inbox";
import { createProposals } from "./proposals";
import { createCrmRecords } from "./records";
import { createWorkflowEngine } from "./workflows/engine";
import type { AutomationDeps } from "./workflows/routes";
import { createScopeLoader } from "./workflows/scope";
import type { AgentTaskStarter } from "./workflows/steps";
import { createWorkflowStore } from "./workflows/store";

const SEND_EVERY_MS = 30_000;
const READ_MAIL_EVERY_MS = 5 * 60_000;
const RUN_EVERY_MS = 3_000;
const SWEEP_EVERY_MS = 60_000;
const PURGE_EVERY_MS = 6 * 3600_000;

const logged =
  (type: string, work: () => Promise<unknown>) => async (): Promise<void> => {
    try {
      await work();
    } catch (error) {
      console.error(
        JSON.stringify({
          type,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  };

/** The CRM's server-side parts that outlive a request, and the loops that drive them. */
export function createCrmServices(deps: {
  database: Database;
  encryptionKey: string;
  // Where people open the app (proposal links) and where the API answers (webhooks).
  appUrl: string;
  apiUrl: string;
  writeText?: WriteText;
  hasModel?: () => Promise<boolean>;
  startAgentTask?: AgentTaskStarter;
  allowPrivateHosts?: boolean;
  // Tests send and read mail without servers.
  createTransport?: CreateTransport;
  readInbox?: ReadInbox;
}) {
  const { database } = deps;
  const records = createCrmRecords(database);
  const mail = createCrmMail(deps);
  const inbox = createCrmInbox(deps);
  const proposals = createProposals({
    database,
    records,
    mail,
    publicUrl: deps.appUrl,
    ...(deps.writeText ? { writeText: deps.writeText } : {}),
  });
  const engine = createWorkflowEngine({
    database,
    records,
    mail,
    proposals,
    scopes: createScopeLoader({ database, publicUrl: deps.appUrl }),
    owner: `${hostname()}:${process.pid}`,
    ...(deps.writeText ? { writeText: deps.writeText } : {}),
    ...(deps.startAgentTask ? { startAgentTask: deps.startAgentTask } : {}),
    allowPrivateHosts: deps.allowPrivateHosts ?? false,
  });
  const workflows = createWorkflowStore({ database });
  const automation: AutomationDeps = {
    database,
    records,
    mail,
    proposals,
    engine,
    workflows,
    encryptionKey: deps.encryptionKey,
    apiUrl: deps.apiUrl,
    hasModel: deps.hasModel ?? (async () => false),
    hasBot: Boolean(deps.startAgentTask),
  };
  let loops: Repeating[] = [];

  return {
    mail,
    inbox,
    proposals,
    engine,
    workflows,
    automation,
    async start() {
      await records.metadata.installStandard();
      await workflows.installRecipes();
      loops = [
        repeatAfterEach(
          logged("crm-mail-send-error", async () => {
            await mail.sendDue();
            await proposals.markSent();
          }),
          SEND_EVERY_MS,
        ),
        repeatAfterEach(
          logged("crm-mail-read-error", () => inbox.readAll()),
          READ_MAIL_EVERY_MS,
        ),
        repeatAfterEach(
          logged("crm-automation-error", async () => {
            while ((await engine.dispatchEvents()) > 0) {}
            while ((await engine.runDue()) > 0) {}
          }),
          RUN_EVERY_MS,
        ),
        repeatAfterEach(
          logged("crm-automation-sweep-error", async () => {
            await engine.sweepDates();
            await engine.sweepSchedules();
          }),
          SWEEP_EVERY_MS,
        ),
        repeatAfterEach(
          logged("crm-automation-purge-error", () => engine.purgeEvents()),
          PURGE_EVERY_MS,
        ),
      ];
    },
    stop() {
      for (const loop of loops) loop.stop();
      loops = [];
    },
  };
}

export type CrmServices = ReturnType<typeof createCrmServices>;
