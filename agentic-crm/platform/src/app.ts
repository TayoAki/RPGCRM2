import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Config } from "./config";
import type { WorkspaceStore } from "./db";
import { landingPage } from "./pages/landing";
import { loginPage, messagePage, signupPage, welcomePage } from "./pages/flows";
import type { Provisioning } from "./provision";
import { decrypt, encrypt, hashOf, randomHex, sameHash } from "./secrets";
import { signupInput, slugRule } from "./signup";

const CLAIM_COOKIE = "magpie_claim";
const SIGNUPS_PER_HOUR = 5;
const PUBLIC = join(import.meta.dir, "..", "public");
const ASSETS: Record<string, string> = {
  "/styles.css": "text/css; charset=utf-8",
  "/site.js": "text/javascript; charset=utf-8",
  "/magpie.svg": "image/svg+xml",
};

export type OwnerLink = { link?: string; signedIn?: boolean };

/** Asks a ready workspace for its owner's set-password link; it answers until they've set one. */
export async function fetchOwnerLink(appUrl: string, setupToken: string): Promise<OwnerLink> {
  const response = await fetch(`${appUrl}/api/workspace/owner-link`, {
    method: "POST",
    headers: { authorization: `Bearer ${setupToken}`, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 409) return { signedIn: true };
  if (!response.ok) throw new Error(`The workspace answered ${response.status}.`);
  return (await response.json()) as OwnerLink;
}

export function createApp(deps: {
  config: Config;
  store: WorkspaceStore;
  provisioning: Provisioning;
  ownerLink?: typeof fetchOwnerLink;
  contactEmail?: string;
}) {
  const app = new Hono();
  const recent = new Map<string, number[]>();
  const secure = deps.config.publicUrl.startsWith("https://");
  const ownerLink = deps.ownerLink ?? fetchOwnerLink;

  const clientOf = (headers: Headers) =>
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const allowSignup = (client: string) => {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const times = (recent.get(client) ?? []).filter((time) => time > hourAgo);
    if (times.length >= SIGNUPS_PER_HOUR) return false;
    recent.set(client, [...times, Date.now()]);
    return true;
  };
  const claimed = (cookie: string | undefined, id: string) => {
    const [claimId, token] = (cookie ?? "").split(".");
    return { matches: claimId === id && Boolean(token), token: token ?? "" };
  };

  for (const [path, type] of Object.entries(ASSETS)) {
    const body = readFileSync(join(PUBLIC, path.slice(1)));
    app.get(path, (context) =>
      context.body(body, 200, { "content-type": type, "cache-control": "public, max-age=300" }),
    );
  }

  app.get("/health", (context) => context.json({ ok: true }));
  app.get("/", (context) => context.html(landingPage(deps.contactEmail)));
  app.get("/signup", (context) =>
    context.html(
      signupPage({
        slug: context.req.query("slug") ?? "",
        email: context.req.query("email") ?? "",
      }),
    ),
  );
  app.get("/login", (context) => context.html(loginPage()));

  app.get("/api/slug/:slug", async (context) => {
    const parsed = slugRule.safeParse(context.req.param("slug"));
    if (!parsed.success) {
      return context.json({ available: false, reason: parsed.error.issues[0]?.message });
    }
    const taken = await deps.store.bySlug(parsed.data);
    return context.json({ available: !taken, ...(taken ? { reason: "That address is taken." } : {}) });
  });

  app.post("/api/signup", async (context) => {
    const parsed = signupInput.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return context.json({ error: issue?.message ?? "Check the form.", field: issue?.path[0] }, 400);
    }
    if (!allowSignup(clientOf(context.req.raw.headers))) {
      return context.json({ error: "That's a lot of workspaces. Try again in an hour." }, 429);
    }
    if ((await deps.store.count()) >= deps.config.maxWorkspaces) {
      return context.json({ error: "We're full for now. Try again soon." }, 503);
    }
    if (await deps.store.bySlug(parsed.data.slug)) {
      return context.json({ error: "That address is taken.", field: "slug" }, 409);
    }
    const claim = randomHex();
    const workspace = await deps.store
      .create({
        slug: parsed.data.slug,
        company: parsed.data.company,
        ownerName: parsed.data.name,
        ownerEmail: parsed.data.email,
        claimHash: hashOf(claim),
        setupTokenSealed: encrypt(deps.config.secret, randomHex()),
      })
      .catch(() => null);
    if (!workspace) return context.json({ error: "That address is taken.", field: "slug" }, 409);
    setCookie(context, CLAIM_COOKIE, `${workspace.id}.${claim}`, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    void deps.provisioning.start(workspace.id);
    return context.json({ id: workspace.id, next: `/welcome/${workspace.id}` }, 201);
  });

  app.get("/welcome/:id", async (context) => {
    const id = context.req.param("id");
    const workspace = /^[0-9a-f-]{36}$/.test(id) ? await deps.store.get(id) : undefined;
    const claim = claimed(getCookie(context, CLAIM_COOKIE), id);
    if (!workspace || !claim.matches || !sameHash(claim.token, workspace.claim_hash)) {
      return context.html(
        messagePage("This page is for whoever signed up", "Open it from the browser you signed up in, or find your workspace from Log in."),
        404,
      );
    }
    return context.html(welcomePage(workspace.id, workspace.company));
  });

  app.get("/api/workspaces/:id", async (context) => {
    const id = context.req.param("id");
    const workspace = /^[0-9a-f-]{36}$/.test(id) ? await deps.store.get(id) : undefined;
    const claim = claimed(getCookie(context, CLAIM_COOKIE), id);
    if (!workspace || !claim.matches || !sameHash(claim.token, workspace.claim_hash)) {
      return context.json({ error: "Not found." }, 404);
    }
    const base = {
      status: workspace.status,
      step: workspace.step,
      error: workspace.error,
      app_url: workspace.app_url,
      owner_email: workspace.owner_email,
    };
    if (workspace.status !== "ready" || !workspace.app_url) return context.json(base);
    const owner = await ownerLink(
      workspace.app_url,
      decrypt(deps.config.secret, workspace.setup_token_sealed),
    ).catch(() => ({}) as OwnerLink);
    return context.json({ ...base, owner_link: owner.link ?? null, signed_in: owner.signedIn ?? false });
  });

  app.post("/api/login", async (context) => {
    const body = (await context.req.json().catch(() => null)) as { slug?: unknown } | null;
    const parsed = slugRule.safeParse(body?.slug);
    const workspace = parsed.success ? await deps.store.bySlug(parsed.data) : undefined;
    if (!workspace) return context.json({ error: "There's no workspace at that address." }, 404);
    if (workspace.status !== "ready" || !workspace.app_url) {
      return context.json({ error: "That workspace is still being set up." }, 409);
    }
    return context.json({ url: `${workspace.app_url}/sign` });
  });

  app.notFound((context) => context.html(messagePage("Not found", "There's nothing at this address."), 404));
  return app;
}
