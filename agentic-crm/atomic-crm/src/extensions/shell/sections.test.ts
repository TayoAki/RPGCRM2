import { activeTab, objectTabs, sectionOf, settingsTabs } from "./sections";

describe("frame sections", () => {
  test("a page belongs to the record type, report or settings it is about", () => {
    expect(sectionOf("/")).toEqual({ key: "home" });
    expect(sectionOf("/contacts/12/show")).toEqual({
      key: "object",
      object: "contacts",
    });
    expect(sectionOf("/o/deals")).toEqual({ key: "object", object: "deals" });
    expect(sectionOf("/o/projects/4")).toEqual({
      key: "object",
      object: "projects",
    });
    expect(sectionOf("/o")).toEqual({ key: "records" });
    expect(sectionOf("/reports/3")).toEqual({ key: "reports" });
    expect(sectionOf("/settings/roles")).toEqual({ key: "settings" });
    expect(sectionOf("/profile")).toEqual({ key: "settings" });
  });

  test("an object's tabs are its own screen, its layouts, then its saved views", () => {
    const tabs = objectTabs("deals", { board: true, calendar: true }, [
      {
        id: 7,
        object: "deals",
        name: "Big ones",
        type: "table",
        config: {},
        shared: true,
        sales_id: null,
      },
    ]);

    expect(tabs.map((tab) => tab.label)).toEqual([
      "Pipeline",
      "Table",
      "Board",
      "Calendar",
      "Big ones",
    ]);
    expect(activeTab(tabs, "/deals", "")?.label).toBe("Pipeline");
    expect(activeTab(tabs, "/deals/5/show", "")?.label).toBe("Pipeline");
    expect(activeTab(tabs, "/o/deals", "")?.label).toBe("Table");
    expect(activeTab(tabs, "/o/deals", "?layout=calendar")?.label).toBe(
      "Calendar",
    );
    expect(activeTab(tabs, "/o/deals", "?view=7")?.label).toBe("Big ones");
    expect(activeTab(tabs, "/o/deals/9", "")?.label).toBe("Table");
  });

  test("a person who isn't an admin sees only their own settings", () => {
    expect(settingsTabs(false).map((tab) => tab.label)).toEqual([
      "API keys",
      "Profile",
    ]);
    expect(activeTab(settingsTabs(true), "/settings/roles", "")?.label).toBe(
      "Roles",
    );
  });
});
