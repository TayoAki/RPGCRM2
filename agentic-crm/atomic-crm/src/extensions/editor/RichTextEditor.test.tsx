import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { RichTextEditor } from "./RichTextEditor";

const PROPOSAL = [
  "## Scope",
  "- Design\n- Build",
  "| Item | Price |\n| --- | --- |\n| Setup | 500 |",
  "Price: [amount], see https://acme.test",
].join("\n\n");

const renderEditor = async (value: string) => {
  const saved: string[] = [];
  const screen = await render(
    <RichTextEditor
      label="Proposal"
      value={value}
      onChange={(markdown) => saved.push(markdown)}
    />,
  );
  return { screen, latest: () => saved.at(-1) ?? "" };
};

describe("RichTextEditor", () => {
  it("shows Markdown as formatted text and keeps its structure when edited", async () => {
    const { screen, latest } = await renderEditor(PROPOSAL);

    await expect
      .element(screen.getByRole("heading", { name: "Scope" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("cell", { name: "Setup" }))
      .toBeVisible();
    await userEvent.click(screen.getByRole("heading", { name: "Scope" }));
    await userEvent.keyboard("{End} and timeline");

    expect(latest()).toContain("## Scope and timeline");
    expect(latest()).toContain("- Design\n- Build");
    expect(latest()).toMatch(/\| Setup\s*\| 500\s*\|/);
    expect(latest()).toContain("Price: [amount], see");
  });

  it("formats the selected words from the toolbar", async () => {
    const { screen, latest } = await renderEditor("Total due on signing");

    await userEvent.tripleClick(screen.getByText("Total due on signing"));
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(latest()).toBe("**Total due on signing**");
    await expect
      .element(screen.getByRole("button", { name: "Bold" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
