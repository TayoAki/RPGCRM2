import type { PriceLine, PricingModel } from "./kontract-api";

// Ported from Kontract's src/lib/bid-math.ts.

export type BidTotals = {
  subPerPeriod: number;
  pricePerPeriod: number;
  profitPerPeriod: number;
  subTotal: number;
  priceTotal: number;
  profitTotal: number;
  /** Profit as a share of what you charge the government. */
  margin: number | null;
  /** How much the subcontractor's cost is marked up. */
  markup: number | null;
};

const lineSub = (line: PriceLine) => (line.quantity || 0) * (line.subCost || 0);
const linePrice = (line: PriceLine) => (line.quantity || 0) * (line.price || 0);

export function bidTotals(model: PricingModel): BidTotals {
  const periods = Math.max(1, model.periods || 1);
  const subPerPeriod = model.lines.reduce(
    (sum, line) => sum + lineSub(line),
    0,
  );
  const pricePerPeriod = model.lines.reduce(
    (sum, line) => sum + linePrice(line),
    0,
  );
  const profitPerPeriod = pricePerPeriod - subPerPeriod;
  return {
    subPerPeriod,
    pricePerPeriod,
    profitPerPeriod,
    subTotal: subPerPeriod * periods,
    priceTotal: pricePerPeriod * periods,
    profitTotal: profitPerPeriod * periods,
    margin: pricePerPeriod > 0 ? profitPerPeriod / pricePerPeriod : null,
    markup: subPerPeriod > 0 ? profitPerPeriod / subPerPeriod : null,
  };
}

/** Every line priced at its sub cost plus `markupPct` percent, to the cent. */
export function applyMarkup(
  model: PricingModel,
  markupPct: number,
): PricingModel {
  return {
    ...model,
    lines: model.lines.map((line) => ({
      ...line,
      price: Math.round(line.subCost * (1 + markupPct / 100) * 100) / 100,
    })),
  };
}

/**
 * The price against the past-award anchor: per year for multi-year contracts, whole contract
 * otherwise. -0.4 is 40% below.
 */
export function vsAnchor(model: PricingModel): number | null {
  const anchor = model.anchor;
  if (!anchor) return null;
  const totals = bidTotals(model);
  if (
    model.periodLabel === "year" &&
    anchor.annual &&
    anchor.annual > 0 &&
    totals.pricePerPeriod > 0
  ) {
    return totals.pricePerPeriod / anchor.annual - 1;
  }
  if (anchor.total > 0 && totals.priceTotal > 0)
    return totals.priceTotal / anchor.total - 1;
  return null;
}
