import { escape, header, icon, page, wordmark } from "./layout";

const workspaceTiles = [
  ["users", "Contacts"],
  ["building", "Companies"],
  ["handshake", "Deals"],
  ["calendar", "Meetings"],
  ["zap", "Automations"],
  ["chart", "Reports"],
] as const;

const features = [
  ["handshake", "A pipeline you can see", "Drag deals between stages, or switch to a table or calendar. Stage changes are kept, so you can see what moved and when."],
  ["layers", "Your own objects and fields", "Track what your business tracks: projects, orders, sites, anything. Add fields, views and filters without asking a developer."],
  ["zap", "Automations that do the busywork", "Twelve ready-made automations on day one, from welcome emails to stale-deal nudges. Build your own with triggers, steps and AI."],
  ["chart", "Reports anyone can read", "Sums, counts and trends over any object, as numbers, bars or lines. Ask the assistant for a chart and it builds it."],
  ["mail", "Email where the deal is", "Connect a mailbox and conversations land on the right contact. Send from the CRM and keep a record of every message."],
  ["phone", "Works on your phone", "Contacts, companies, deals and tasks fit the small screen, so the follow-up happens from the car park."],
] as const;

const security = [
  ["layers", "Your own database", "Every company gets its own app and its own database. Your records never share a table with anyone else's."],
  ["key", "Single sign-on", "Connect Okta, Entra ID, Google Workspace or any OpenID Connect or SAML provider, and require it if you like."],
  ["users", "Directory sync", "SCIM adds people, keeps their groups current, and switches off access and API keys the day someone leaves."],
  ["shield", "Roles down to the field", "Decide who sees and changes each object and field. The API, exports and the assistant follow the same rules."],
] as const;

const faqs = [
  ["Is my data kept apart from other companies?", "Yes. Each workspace is its own app with its own database. Nothing is shared between companies, and you can export everything at any time."],
  ["Do I need a credit card?", "No. Workspaces are free during early access. We'll tell you well before anything changes."],
  ["How do I bring in my team?", "Add people from Admin, People and send them their link, or connect your company's sign-in and let everyone at your domain in. Directory sync (SCIM) can add and remove people for you."],
  ["What can the assistant do?", "Find and update records, draft emails, run reports and build charts, and take on routine follow-ups. Anything that changes your data waits for your OK first."],
  ["Can I connect other tools?", "There's a REST API with keys for every object you create, webhooks for bookings and forms, and mailbox sync for email."],
  ["Where is it hosted?", "Each workspace runs in its own container and database in the cloud. Ask us if you need a specific region or your own infrastructure."],
] as const;

const tile = ([name, label]: readonly [Parameters<typeof icon>[0], string]) =>
  `<div class="tile">${icon(name, 22)}<span>${label}</span></div>`;

export const landingPage = (contact?: string) =>
  page({
    title: "Magpie CRM",
    description: "A CRM with an assistant that does the follow-up. Your own workspace and database, single sign-on, and automations from day one.",
    script: "site",
    body: `
<div class="hero-wrap">
${header()}
<section class="hero">
  <a class="badge" href="#security"><span class="dot"></span> SSO and directory sync on every workspace ${icon("arrow", 14)}</a>
  <h1>Conversations in. Deals out.</h1>
  <p class="hero-sub"><span class="mono">Turn</span> your inbox, calls and notes <span class="mono">into</span> a pipeline that keeps itself up to date</p>

  <div class="hero-grid">
    <div class="hero-col">
      <p class="eyebrow muted">Assistant</p>
      <div class="card agent">
        <div class="agent-head">
          <img src="/magpie.svg" alt="" width="34" height="34" />
          <div><strong>Maggie</strong><span class="mono small muted">assistant:your-crm</span></div>
          <span class="chip live"><i></i>online</span>
        </div>
        <div class="agent-prompt"><span class="mono muted">›</span> <span class="mono">who needs a follow-up today?</span><span class="run">run ↵</span></div>
      </div>
      <div class="chips"><span class="mono small muted">try</span><span class="chip active">deals at risk</span><span class="chip">draft intro</span><span class="chip">pipeline chart</span></div>
      <ol class="steps mono">
        <li class="done">${icon("check", 14)} read 38 open deals</li>
        <li class="done">${icon("check", 14)} check last contact dates</li>
        <li>${icon("sparkles", 14)} draft 4 follow-ups for your OK</li>
      </ol>
    </div>

    <div class="device" aria-hidden="true">
      <div class="device-body">
        <span class="device-brand mono">magpie.</span>
        <div class="device-screen">
          <span class="mono">pipeline this quarter</span>
          <strong>$482,300</strong>
          <span class="mono small">+18% on last quarter</span>
        </div>
      </div>
    </div>

    <div class="hero-col">
      <p class="eyebrow accent">Your workspace</p>
      <div class="tiles">${workspaceTiles.map(tile).join("")}</div>
      <p class="mono small muted center">+ any object you add</p>
    </div>
  </div>

  <div class="command mono"><span class="muted">$</span> maggie <span class="accent">draft</span> renewal email for Acme <span class="spinner"></span></div>

  <form class="claim" action="/signup" method="get">
    <p>Start your workspace</p>
    <div class="claim-row">
      <span class="mono muted">https://magpie-</span><input class="mono" name="slug" placeholder="acme" aria-label="Workspace name" autocomplete="off" /><span class="mono muted">.up.railway.app</span>
      <button class="button light" type="submit">Start free ${icon("arrow", 14)}</button>
    </div>
  </form>
  <p class="trust mono small muted">No credit card · Your own database · Ready in minutes</p>
</section>
</div>

<section class="night">
  <p class="eyebrow accent center">One company. One database.</p>
  <p class="big-number">12<span>+</span></p>
  <p class="center night-sub">automations ready on day one, and an assistant that builds the rest with you</p>
  <div class="works-with">
    <span class="muted small">Works with</span>
    <ul class="mono"><li>Gmail</li><li>Any IMAP mailbox</li><li>Okta</li><li>Entra ID</li><li>Google Workspace</li><li>REST API</li><li>Webhooks</li></ul>
  </div>

  <div class="panel" id="assistant">
    <div class="panel-head">
      <h2>Ask your CRM. It does the work.</h2>
      <p>Maggie reads your records, drafts the email, builds the chart and books the follow-up. You approve anything that changes your data.</p>
    </div>
    <div class="panel-grid">
      <div class="asks">
        <p class="eyebrow muted">You ask</p>
        <div class="ask">“Which deals slipped this week?”</div>
        <div class="ask">“Draft a follow-up for the Acme renewal.”</div>
        <div class="ask">“Chart won deals by month.”</div>
      </div>
      <div class="pair" aria-hidden="true">
        <div class="cube dark">${icon("sparkles", 40)}<span class="mono">assistant</span></div>
        <div class="cube light"><img src="/magpie.svg" alt="" width="56" height="56" /><span class="mono">your crm</span></div>
      </div>
      <div class="result">
        <p class="eyebrow muted">Waiting for your OK</p>
        <p class="result-title">Renewal: Acme Corp</p>
        <p class="result-body">Hi Dana, your plan renews on the 30th. Want to keep the same seats, or add the two new starters from last month?</p>
        <div class="result-actions"><span class="button small dark">Approve</span><span class="button small ghost">Edit</span></div>
      </div>
    </div>
    <div class="panel-foot">
      <span class="small muted">${icon("shield", 14)} Every change the assistant makes waits for your OK.</span>
      <a class="button accent" href="/signup">Try it free ${icon("arrow", 14)}</a>
    </div>
  </div>
</section>

<section class="night" id="product">
  <div class="section-head">
    <h2>Everything a sales team needs.</h2>
    <p class="muted">And the things it didn't know it needed.</p>
  </div>
  <div class="feature-grid">
    ${features.map(([name, title, text]) => `<article class="feature">${icon(name, 22)}<h3>${title}</h3><p>${text}</p></article>`).join("")}
  </div>
</section>

<section class="night" id="security">
  <div class="section-head">
    <h2>Ready for the security questionnaire.</h2>
    <p class="muted">Built for companies whose IT team asks first.</p>
  </div>
  <div class="security-grid">
    ${security.map(([name, title, text]) => `<article class="security">${icon(name, 20)}<div><h3>${title}</h3><p>${text}</p></div></article>`).join("")}
  </div>
</section>

<section class="night" id="pricing">
  <div class="section-head center-head">
    <h2>Simple while we're early.</h2>
    <p class="muted">Every feature, free during early access.</p>
  </div>
  <div class="plans">
    <article class="plan featured">
      <p class="eyebrow accent">Early access</p>
      <p class="price">$0 <span>per workspace</span></p>
      <ul>${["Your own app and database", "Unlimited contacts, companies and deals", "Custom objects, fields and views", "Automations and the assistant", "Single sign-on and directory sync", "REST API and webhooks"].map((line) => `<li>${icon("check", 16)}${line}</li>`).join("")}</ul>
      <a class="button accent block" href="/signup">Start free</a>
    </article>
    <article class="plan">
      <p class="eyebrow muted">Enterprise</p>
      <p class="price">Let's talk</p>
      <ul>${["Your own domain", "Sign-in required through your provider", "A region or cloud of your choice", "Help moving from your current CRM", "A named person to call"].map((line) => `<li>${icon("check", 16)}${line}</li>`).join("")}</ul>
      ${contact ? `<a class="button outline block" href="mailto:${escape(contact)}">Talk to us ${icon("arrow", 14)}</a>` : `<a class="button outline block" href="/signup">Start free, then ask us</a>`}
    </article>
  </div>
</section>

<section class="night" id="faq">
  <h2 class="center">Questions, answered.</h2>
  <div class="faq">
    ${faqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join("")}
  </div>
</section>

<section class="night">
  <div class="final">
    <h2>Your next deal is already <mark>in your inbox.</mark></h2>
    <p class="muted">Free during early access. No credit card.</p>
    <div class="final-actions">
      <a class="button accent mono" href="/signup">Start your workspace</a>
      <a class="button outline mono" href="/login">Log in</a>
    </div>
  </div>
</section>

<footer class="site-footer">
  <div>
    ${wordmark}
    <p class="muted small">The CRM with an assistant that does the follow-up.</p>
    <div class="final-actions"><a class="button accent small mono" href="/signup">Get started</a><a class="button outline small mono" href="/login">Log in</a></div>
  </div>
  <nav aria-label="Footer">
    <div><p class="eyebrow accent">Product</p><a href="#assistant">Assistant</a><a href="#product">Features</a><a href="#security">Security</a><a href="#pricing">Pricing</a></div>
    <div><p class="eyebrow accent">Start</p><a href="/signup">Create a workspace</a><a href="/login">Find your workspace</a><a href="#faq">FAQ</a></div>
    ${contact ? `<div><p class="eyebrow accent">Company</p><a href="mailto:${escape(contact)}">Contact</a></div>` : ""}
  </nav>
  <p class="copyright small muted">© ${new Date().getFullYear()} Magpie CRM</p>
</footer>`,
  });
