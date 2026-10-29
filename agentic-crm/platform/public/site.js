const slugFrom = (text) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 30)
    .replace(/-+$/, "");

const showError = (form, message) => {
  const box = form.querySelector("[data-error]");
  if (box) box.textContent = message || "";
};

const post = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
};

const signup = document.querySelector('[data-form="signup"]');
if (signup) {
  const company = signup.elements.company;
  const slug = signup.elements.slug;
  const hint = signup.querySelector('[data-hint="slug"]');
  let slugEdited = Boolean(slug.value);
  let checking;
  const check = () => {
    clearTimeout(checking);
    checking = setTimeout(async () => {
      if (!slug.value) return;
      const response = await fetch(`/api/slug/${encodeURIComponent(slug.value)}`);
      const result = await response.json().catch(() => ({}));
      hint.textContent = result.available ? "Available." : result.reason || "Not available.";
      hint.dataset.state = result.available ? "ok" : "bad";
    }, 250);
  };
  company.addEventListener("input", () => {
    if (!slugEdited) {
      slug.value = slugFrom(company.value);
      check();
    }
  });
  slug.addEventListener("input", () => {
    slugEdited = true;
    slug.value = slug.value.toLowerCase();
    check();
  });
  if (slug.value) check();
  signup.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(signup, "");
    const button = signup.querySelector("button[type=submit]");
    button.disabled = true;
    const { ok, data } = await post("/api/signup", Object.fromEntries(new FormData(signup)));
    if (ok) {
      window.location.assign(data.next);
      return;
    }
    button.disabled = false;
    showError(signup, data.error || "Something went wrong. Try again.");
    if (data.field && signup.elements[data.field]) signup.elements[data.field].focus();
  });
}

const login = document.querySelector('[data-form="login"]');
if (login) {
  login.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(login, "");
    const { ok, data } = await post("/api/login", Object.fromEntries(new FormData(login)));
    if (ok) window.location.assign(data.url);
    else showError(login, data.error || "Something went wrong. Try again.");
  });
}

const welcome = document.querySelector("[data-welcome]");
if (welcome) {
  const id = welcome.dataset.welcome;
  const order = ["project", "database", "app", "building"];
  const render = (state) => {
    const current = state.status === "ready" ? "ready" : state.step;
    const at = order.indexOf(current);
    for (const item of welcome.querySelectorAll("[data-step]")) {
      const index = order.indexOf(item.dataset.step);
      item.dataset.state = index < at || state.status === "ready" ? "done" : index === at ? "active" : "";
    }
    showError(welcome, state.status === "failed" || state.step === "waiting" ? state.error : "");
    if (state.status === "ready") {
      welcome.querySelector("[data-ready]").hidden = false;
      welcome.querySelector(".progress-steps").hidden = true;
      const title = document.querySelector("[data-title]");
      title.textContent = `${title.dataset.title} is ready`;
      welcome.querySelector("[data-owner-email]").textContent = state.owner_email;
      const link = welcome.querySelector("[data-owner-link]");
      const appLink = welcome.querySelector("[data-app-link]");
      appLink.href = `${state.app_url}/sign`;
      appLink.textContent = state.app_url.replace(/^https:\/\//, "");
      if (state.owner_link) {
        link.href = state.owner_link;
      } else {
        link.href = `${state.app_url}/sign`;
        link.firstChild.textContent = state.signed_in ? "Sign in " : "Open your CRM ";
      }
      document.querySelector("[data-summary]").textContent = state.owner_link
        ? "Set a password to finish. You'll be the admin."
        : "Sign in with the email below.";
    }
    return state.status === "ready" || state.status === "failed";
  };
  const poll = async () => {
    const response = await fetch(`/api/workspaces/${id}`);
    const state = await response.json().catch(() => null);
    if (state && render(state)) return;
    setTimeout(poll, 5000);
  };
  poll();
}
