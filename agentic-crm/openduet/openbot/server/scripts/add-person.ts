import { createAuditStore } from "../src/audit";
import { createAuth } from "../src/auth";
import {
  createPasswordPeople,
  setPasswordPath,
} from "../src/auth/email-password";
import { loadConfig } from "../src/config";
import { createDatabase } from "../src/db/client";
import { createPeopleStore } from "../src/people/store";

// Adds somebody who signs in with email and password and prints their set-password link. This is how
// a new deployment gets its first admin: name them in INITIAL_ADMIN_EMAILS, then run this.
// Usage: bun --env-file=../.env scripts/add-person.ts <email> <name>
const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
if (!email || !name) {
  console.error("Usage: bun scripts/add-person.ts <email> <name>");
  process.exit(1);
}

const config = loadConfig(process.env);
if (!config.auth?.emailPassword) {
  console.error("Set SIGNIN_EMAIL_PASSWORD=true first.");
  process.exit(1);
}

const database = createDatabase(config.databaseUrl);
const peopleStore = createPeopleStore(database, config.auth.initialAdminEmails);
const auth = createAuth(
  config,
  database,
  (address) => peopleStore.isRevoked(address),
  createAuditStore(database),
);

const { token } = await createPasswordPeople(auth).add({
  email: email.toLowerCase(),
  name,
});
const appUrl = process.env.APP_PUBLIC_URL ?? config.auth.baseUrl;
console.log(`${new URL(setPasswordPath(token), appUrl)}`);
process.exit(0);
