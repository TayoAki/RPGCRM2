import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup, render } from "@testing-library/react";
import { MorningBriefCard } from "@/components/duet/morning-brief-card";
import {
  briefCard,
  readBrief,
  startRequest,
} from "@/lib/copilot/morning-brief-tool";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost/" }));
afterEach(() => cleanup());
afterAll(() => GlobalRegistrator.unregister());

const BRIEF = {
  at: "2026-10-22T08:05:00",
  name: "Maya",
  needsYou: [],
  canWait: [],
  calendar: [],
  couldNotCheck: [],
};

const FOLLOW_UP = {
  id: "task-7",
  kind: "task",
  title: "Send the quote · Ada Lovelace",
  why: "Overdue by 3 days",
  href: "/crm/contacts/4/show",
};

const cardOf = (crm: unknown) => {
  const brief = readBrief(JSON.stringify({ ...BRIEF, crm }));
  if (!brief) throw new Error("no brief");
  return render(<MorningBriefCard {...briefCard(brief)} />);
};

describe("the CRM in the morning brief", () => {
  test("shows each one under Follow up, linking to its CRM page in the app", () => {
    const view = cardOf([FOLLOW_UP]);

    expect(view.getByText("Follow up")).toBeTruthy();
    expect(view.getByText("Overdue by 3 days")).toBeTruthy();
    const link = view
      .getByText("Send the quote · Ada Lovelace")
      .closest("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/crm/contacts/4/show");
    expect(link.getAttribute("target")).toBe(null);
    expect(view.queryByText(/Nothing new needs you/)).toBe(null);
  });

  test("drops CRM rows it doesn't recognise but keeps the rest of the brief", () => {
    const view = cardOf([{ ...FOLLOW_UP, href: "javascript:alert(1)" }]);

    expect(view.getByText("Morning, Maya.")).toBeTruthy();
    expect(view.queryByText("Follow up")).toBe(null);
  });

  test("says when mail is from a CRM contact, and tells the Bot who they are on Start", () => {
    const brief = readBrief(
      JSON.stringify({
        ...BRIEF,
        needsYou: [
          {
            id: "m1",
            threadId: "t1",
            from: "Ana Pereira",
            address: "ana@hearth.test",
            subject: "Friday ship date?",
            reason: "Ana needs the date confirmed today.",
            decidedBy: "model:test",
            crm: { contactId: 42, name: "Ana Pereira", company: "Hearth & Co" },
          },
        ],
      }),
    );
    if (!brief) throw new Error("no brief");
    const [mail] = brief.needsYou;
    if (!mail) throw new Error("no mail");

    const view = render(<MorningBriefCard {...briefCard(brief)} />);

    expect(
      view.getByText(
        "Ana needs the date confirmed today. · In the CRM, at Hearth & Co",
      ),
    ).toBeTruthy();
    expect(startRequest(mail)).toBe(
      "Take care of Ana Pereira's email: Friday ship date? Ana Pereira is contact 42 in the CRM.",
    );
  });
});
