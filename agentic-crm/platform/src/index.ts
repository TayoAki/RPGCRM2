import { createApp } from "./app";
import { loadConfig } from "./config";
import { connect, createWorkspaceStore, migrate } from "./db";
import { createProvisioning } from "./provision";
import { createRailway } from "./railway";

const config = loadConfig();
const sql = connect(config.databaseUrl);
await migrate(sql);
const store = createWorkspaceStore(sql);
const provisioning = createProvisioning({
  config,
  store,
  ...(config.railway ? { provisioner: createRailway(config.railway) } : {}),
});
if (!config.railway) {
  console.warn("RAILWAY_API_TOKEN is not set: sign-ups are recorded but no workspace is created.");
}
await provisioning.resume();

const app = createApp({
  config,
  store,
  provisioning,
  ...(process.env.CONTACT_EMAIL ? { contactEmail: process.env.CONTACT_EMAIL } : {}),
});
Bun.serve({ port: config.port, hostname: "0.0.0.0", fetch: app.fetch });
console.log(`Magpie sign-up listening on ${config.port}`);
