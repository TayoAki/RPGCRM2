import { STEPS } from "../provision";
import { escape, header, icon, page } from "./layout";

const shell = (title: string, inner: string) =>
  page({
    title: `${title} · Magpie CRM`,
    description: "Create and open your Magpie CRM workspace.",
    script: "site",
    body: `<div class="hero-wrap flow-wrap">${header("compact")}<main class="flow">${inner}</main></div>`,
  });

export const signupPage = (prefill: { slug?: string; email?: string }) =>
  shell(
    "Create your workspace",
    `<h1 class="flow-title">Create your workspace</h1>
<p class="muted">Your own CRM and database. You'll be its admin.</p>
<form class="card form" data-form="signup" novalidate>
  <label>Company<input name="company" autocomplete="organization" required maxlength="80" /></label>
  <label>Your name<input name="name" autocomplete="name" required maxlength="80" /></label>
  <label>Work email<input name="email" type="email" autocomplete="email" required value="${escape(prefill.email ?? "")}" /></label>
  <label>Workspace address
    <span class="address mono"><span class="muted">magpie-</span><input name="slug" class="mono" required maxlength="30" value="${escape(prefill.slug ?? "")}" autocomplete="off" /><span class="muted">.up.railway.app</span></span>
    <small class="hint" data-hint="slug">Lowercase letters, digits and dashes.</small>
  </label>
  <p class="form-error" role="alert" data-error></p>
  <button class="button dark block" type="submit">Create workspace ${icon("arrow", 14)}</button>
  <p class="small muted center">Free during early access. No credit card.</p>
</form>
<p class="small muted center">Already have one? <a href="/login">Find your workspace</a></p>`,
  );

export const welcomePage = (id: string, company: string) =>
  shell(
    "Setting up",
    `<h1 class="flow-title">Setting up ${escape(company)}</h1>
<p class="muted" data-summary>This takes a few minutes. You can leave this page open, or come back to it later from this browser.</p>
<div class="card progress" data-welcome="${escape(id)}">
  <ol class="progress-steps">
    ${STEPS.map((step) => `<li data-step="${step.key}"><span class="marker"></span>${escape(step.label)}</li>`).join("")}
    <li data-step="ready"><span class="marker"></span>Ready</li>
  </ol>
  <p class="form-error" role="alert" data-error></p>
  <div class="ready-actions" data-ready hidden>
    <a class="button dark block" data-owner-link href="#">Set your password ${icon("arrow", 14)}</a>
    <p class="small muted">Then sign in at <a data-app-link href="#"></a> and add your team from Admin, People.</p>
  </div>
</div>`,
  );

export const loginPage = () =>
  shell(
    "Find your workspace",
    `<h1 class="flow-title">Find your workspace</h1>
<p class="muted">Each company has its own address.</p>
<form class="card form" data-form="login" novalidate>
  <label>Workspace address
    <span class="address mono"><span class="muted">magpie-</span><input name="slug" class="mono" required maxlength="30" autocomplete="off" /><span class="muted">.up.railway.app</span></span>
  </label>
  <p class="form-error" role="alert" data-error></p>
  <button class="button dark block" type="submit">Continue ${icon("arrow", 14)}</button>
</form>
<p class="small muted center">New here? <a href="/signup">Create a workspace</a></p>`,
  );

export const messagePage = (title: string, message: string) =>
  shell(title, `<h1 class="flow-title">${escape(title)}</h1><p class="muted">${escape(message)}</p><p><a class="button dark" href="/">Back home</a></p>`);
