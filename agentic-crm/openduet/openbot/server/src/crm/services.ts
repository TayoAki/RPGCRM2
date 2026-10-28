import type { Database } from "../db/client";
import { type Repeating, repeatAfterEach } from "../work/loop";
import { createCrmMail } from "./mail";
import { createCrmInbox } from "./mail-inbox";

const SEND_EVERY_MS = 30_000;
const READ_MAIL_EVERY_MS = 5 * 60_000;

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
}) {
  const mail = createCrmMail(deps);
  const inbox = createCrmInbox(deps);
  let loops: Repeating[] = [];

  return {
    mail,
    inbox,
    start() {
      loops = [
        repeatAfterEach(
          logged("crm-mail-send-error", () => mail.sendDue()),
          SEND_EVERY_MS,
        ),
        repeatAfterEach(
          logged("crm-mail-read-error", () => inbox.readAll()),
          READ_MAIL_EVERY_MS,
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
