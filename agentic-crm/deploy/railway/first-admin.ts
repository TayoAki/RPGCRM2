import postgres from "postgres";

// Runs on every start, so it only adds the first admin once: while nobody has that email yet.
const email = process.argv[2]?.trim().toLowerCase();
if (!email) process.exit(0);

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
const [existing] = await sql`select 1 from users where lower(email) = ${email}`;
await sql.end();
if (existing) process.exit(0);

const added = Bun.spawnSync(
  ["bun", "scripts/add-person.ts", email, email.split("@")[0]],
  { stdout: "pipe", stderr: "inherit" },
);
if (added.exitCode !== 0) process.exit(added.exitCode ?? 1);
const link = added.stdout.toString().trim().split("\n").pop();
console.log(`First admin ${email} sets a password here (valid 3 days): ${link}`);
