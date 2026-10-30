/*
 * The ideal customer profile, read from the deals the workspace has won: what those companies have
 * in common, as counts a Bot can turn into a description and a search.
 */

type WonDeal = { amount: number | null; company_id: number | null };
type Company = {
  id: number;
  name: string;
  sector: string | null;
  size: number | null;
  city: string | null;
  country: string | null;
  lead_source: string | null;
  website: string | null;
};

export type ProfileFacts = {
  wonDeals: number;
  averageDeal: number | null;
  medianDeal: number | null;
  sectors: { value: string; count: number }[];
  sizes: { value: string; count: number }[];
  countries: { value: string; count: number }[];
  cities: { value: string; count: number }[];
  leadSources: { value: string; count: number }[];
  bestCustomers: { name: string; website: string | null; won: number }[];
};

// The CRM stores size as a headcount band's lower bound (1, 10, 50, 250, 500).
const SIZE_BANDS: [number, string][] = [
  [500, "500+ employees"],
  [250, "250-499 employees"],
  [50, "50-249 employees"],
  [10, "10-49 employees"],
  [1, "1-9 employees"],
];

const sizeBand = (size: number | null) =>
  size == null
    ? null
    : (SIZE_BANDS.find(([floor]) => size >= floor)?.[1] ?? null);

function tally(values: (string | null | undefined)[], limit = 5) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort(
      (one, other) =>
        other.count - one.count || one.value.localeCompare(other.value),
    )
    .slice(0, limit);
}

export function profileFacts(
  deals: WonDeal[],
  companies: Company[],
): ProfileFacts {
  const byId = new Map(companies.map((company) => [company.id, company]));
  const won = deals.filter((deal) => deal.company_id != null);
  const customers = won
    .map((deal) => byId.get(deal.company_id as number))
    .filter((company): company is Company => company !== undefined);
  const amounts = deals
    .map((deal) => deal.amount ?? 0)
    .filter((amount) => amount > 0)
    .sort((one, other) => one - other);
  const totals = new Map<number, number>();
  for (const deal of won) {
    const id = deal.company_id as number;
    totals.set(id, (totals.get(id) ?? 0) + (deal.amount ?? 0));
  }
  return {
    wonDeals: deals.length,
    averageDeal: amounts.length
      ? Math.round(
          amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
        )
      : null,
    medianDeal: amounts.length ? amounts[Math.floor(amounts.length / 2)] : null,
    sectors: tally(customers.map((company) => company.sector)),
    sizes: tally(customers.map((company) => sizeBand(company.size))),
    countries: tally(customers.map((company) => company.country)),
    cities: tally(customers.map((company) => company.city)),
    leadSources: tally(customers.map((company) => company.lead_source)),
    bestCustomers: [...totals.entries()]
      .sort(([, one], [, other]) => other - one)
      .slice(0, 8)
      .flatMap(([id, total]) => {
        const company = byId.get(id);
        return company
          ? [{ name: company.name, website: company.website, won: total }]
          : [];
      }),
  };
}
