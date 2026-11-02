#!/usr/bin/env node
// Fills a Magpie workspace with a small prime contractor that subs out government service work:
// a bench of real Austin subcontractors from Kontract's permit data, sample janitorial and grounds
// subs, and sample past contracts. Open bids come later, from the Bots, through Kontract.
//
//   KONTRACT_URL=https://… KONTRACT_SERVICE_KEY=… node seed.mjs https://your-workspace.up.railway.app mgp_your_api_key
//
// Needs Node 18 or newer. Create the API key in the CRM: Settings, API keys.

const [base, key] = process.argv.slice(2);
const kontractUrl = process.env.KONTRACT_URL?.replace(/\/+$/, "");
const serviceKey = process.env.KONTRACT_SERVICE_KEY;
if (!base || !key || !kontractUrl || !serviceKey) {
  console.error(
    "Usage: KONTRACT_URL=… KONTRACT_SERVICE_KEY=… node seed.mjs <workspace url> <CRM API key>",
  );
  process.exit(1);
}

const DAY = 86_400_000;
const at = (days) => new Date(Date.now() + days * DAY).toISOString();

// Trades Austin's permit feed names, and the sector each sub is filed under.
const PERMIT_TRADES = [
  { work: "hvac", sector: "Subcontractor: HVAC" },
  { work: "plumbing", sector: "Subcontractor: Plumbing" },
  { work: "electrical", sector: "Subcontractor: Electrical" },
  { work: "roofing", sector: "Subcontractor: Roofing" },
];
const PER_TRADE = 3;

// Permits don't cover cleaning or grounds work, so these are made up and say so.
const SAMPLE_SUBS = [
  {
    name: "Sample: Lone Star Commercial Cleaning",
    sector: "Subcontractor: Janitorial",
    phone: "+1 555 0101",
    description: "Sample sub for testing. Office and clinic cleaning, nights and weekends, 40 staff.",
  },
  {
    name: "Sample: Hill Country Facility Care",
    sector: "Subcontractor: Janitorial",
    phone: "+1 555 0102",
    description: "Sample sub for testing. Day porter and floor care for federal buildings.",
  },
  {
    name: "Sample: Pecan Grove Grounds",
    sector: "Subcontractor: Grounds",
    phone: "+1 555 0103",
    description: "Sample sub for testing. Mowing, irrigation and snow removal on multi-acre sites.",
  },
];

const SAMPLE_CUSTOMERS = [
  { name: "Sample: Federal Building, Austin TX", sector: "Government" },
  { name: "Sample: VA Outpatient Clinic, Round Rock TX", sector: "Government" },
];

const SAMPLE_DEALS = [
  {
    name: "Sample: Janitorial services, Federal Building (base + 2 options)",
    customer: 0,
    stage: "won",
    amount: 184_000,
    daysAgo: 300,
    description:
      "Sample record for testing, not real past performance. Subbed to Lone Star Commercial Cleaning at 72% of price.",
  },
  {
    name: "Sample: Grounds maintenance, VA clinic (1 year)",
    customer: 1,
    stage: "won",
    amount: 46_500,
    daysAgo: 160,
    description:
      "Sample record for testing, not real past performance. Subbed to Pecan Grove Grounds.",
  },
  {
    name: "Sample: HVAC preventive maintenance, Federal Building",
    customer: 0,
    stage: "lost",
    amount: 92_000,
    daysAgo: 45,
    description:
      "Sample record for testing. Lost on price: the winner came in 18% under our bid.",
  },
];

async function kontract(path) {
  const response = await fetch(`${kontractUrl}/api/v1${path}`, {
    headers: {
      authorization: `Bearer ${serviceKey}`,
      "x-workspace-id": "magpie-sample-seed",
    },
  });
  if (!response.ok) throw new Error(`Kontract ${path} failed (${response.status}).`);
  return response.json();
}

async function seed() {
  const api = `${base.replace(/\/+$/, "")}/api/v1`;
  const call = async (method, path, body) => {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const answer = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${method} ${path} failed (${response.status}): ${answer.error ?? response.statusText}`);
    }
    return answer.data;
  };
  const create = (object, body) => call("POST", `/${object}`, body);

  const me = await call("GET", "/me");
  console.log(`Signed in as ${me.first_name} ${me.last_name}.`);
  const existing = await call(
    "GET",
    `/companies?filter=${encodeURIComponent(JSON.stringify({ name: SAMPLE_SUBS[0].name }))}`,
  );
  if (existing.length) {
    throw new Error("The sample subs are already in this workspace. Nothing was added.");
  }

  let real = 0;
  for (const trade of PERMIT_TRADES) {
    const contractors = await kontract(
      `/permits/contractors?state=TX&city=Austin&work=${trade.work}`,
    );
    for (const contractor of contractors.slice(0, PER_TRADE)) {
      await create("companies", {
        name: contractor.name,
        sector: trade.sector,
        city: "Austin",
        state_abbr: "TX",
        country: "USA",
        phone_number: contractor.phone ?? null,
        lead_source: "Austin permit data (Kontract)",
        description: `Pulled ${contractor.permits} ${trade.work} permits in Austin, most recently ${contractor.latest}.${
          contractor.license ? ` License ${contractor.license}.` : ""
        } Permit types: ${contractor.types.join(", ")}. From the city's public permit data, not contacted yet: check the license and ask for an insurance certificate before using them.`,
      });
      real += 1;
    }
  }
  console.log(`Added ${real} subcontractors from Austin permit data.`);

  for (const sub of SAMPLE_SUBS) {
    await create("companies", {
      name: sub.name,
      sector: sub.sector,
      city: "Austin",
      state_abbr: "TX",
      country: "USA",
      phone_number: sub.phone,
      lead_source: "Sample data",
      description: sub.description,
    });
  }
  console.log(`Added ${SAMPLE_SUBS.length} sample subcontractors.`);

  const customerIds = [];
  for (const customer of SAMPLE_CUSTOMERS) {
    customerIds.push(
      (
        await create("companies", {
          ...customer,
          city: "Austin",
          state_abbr: "TX",
          country: "USA",
          lead_source: "Sample data",
          description: "Sample customer for testing.",
        })
      ).id,
    );
  }
  for (const [index, deal] of SAMPLE_DEALS.entries()) {
    await create("deals", {
      name: deal.name,
      company_id: customerIds[deal.customer],
      stage: deal.stage,
      amount: deal.amount,
      description: deal.description,
      expected_closing_date: at(-deal.daysAgo).slice(0, 10),
      lead_source: "Sample data",
      index,
      created_at: at(-deal.daysAgo - 30),
      updated_at: at(-deal.daysAgo),
    });
  }
  console.log(`Added ${SAMPLE_DEALS.length} sample past contracts.`);
  console.log("Done. Next: Today, Tell Magpie about your business.");
}

seed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
