import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { BarList, Donut } from "./Charts";

const rows = (values: number[]) =>
  values.map((value, index) => ({ key: `Region ${index + 1}`, value }));
const label = (key: unknown) => String(key);
const format = (value: number) => `$${value}`;

describe("Donut", () => {
  it("names the five largest shares and folds the rest into Other", async () => {
    const screen = await render(
      <Donut
        rows={rows([40, 20, 10, 10, 10, 5, 5])}
        label={label}
        format={format}
      />,
    );

    await expect.element(screen.getByText("Region 1")).toBeVisible();
    await expect.element(screen.getByText("40%")).toBeVisible();
    await expect.element(screen.getByText("Other (2)")).toBeVisible();
    await expect
      .element(screen.getByRole("listitem").filter({ hasText: "Other (2)" }))
      .toHaveTextContent("Other (2)$1010%");
    expect(screen.getByText("Region 6").query()).toBeNull();
  });
});

describe("BarList", () => {
  it("labels each bar with its value", async () => {
    const screen = await render(
      <BarList
        rows={rows([1200, 300])}
        label={label}
        format={format}
        additive
      />,
    );

    await expect.element(screen.getByText("$1200")).toBeVisible();
    await expect.element(screen.getByText("Region 2")).toBeVisible();
  });

  it("says how many groups are left out when they can't be added up", async () => {
    const screen = await render(
      <BarList
        rows={rows(Array.from({ length: 15 }, (_, index) => 15 - index))}
        label={label}
        format={format}
      />,
    );

    await expect.element(screen.getByText("3 more not shown")).toBeVisible();
  });
});
