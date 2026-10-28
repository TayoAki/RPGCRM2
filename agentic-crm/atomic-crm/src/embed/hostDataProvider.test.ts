import { HttpError } from "ra-core";
import { describe, expect, it } from "vitest";

import { createHostDataProvider } from "./hostDataProvider";

type Sent = { url: URL; method: string; body: any };

// Answers like the CRM API and keeps every request it was sent.
function fakeApi(answer: (sent: Sent) => { status?: number; body: unknown }) {
  const sent: Sent[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const request = {
      url: new URL(input, "http://crm.test"),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    };
    sent.push(request);
    const { status = 200, body } = answer(request);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { sent, dataProvider: createHostDataProvider(fetchImpl) };
}

const filterOf = (sent: Sent) =>
  JSON.parse(sent.url.searchParams.get("filter") ?? "{}");

describe("createHostDataProvider", () => {
  it("asks for a page of a list, sorted and filtered, and returns its rows and total", async () => {
    const { sent, dataProvider } = fakeApi(() => ({
      body: { data: [{ id: 1 }], total: 40 },
    }));

    const result = await dataProvider.getList("tasks", {
      pagination: { page: 2, perPage: 20 },
      sort: { field: "due_date", order: "ASC" },
      filter: { "done_date@is": null },
    });

    expect(result).toEqual({ data: [{ id: 1 }], total: 40 });
    expect(sent[0].url.pathname).toBe("/api/crm/tasks");
    expect(Object.fromEntries(sent[0].url.searchParams)).toMatchObject({
      page: "2",
      perPage: "20",
      sort: "due_date",
      order: "ASC",
    });
    expect(filterOf(sent[0])).toEqual({ "done_date@is": null });
  });

  it("searches the columns the contacts list shows", async () => {
    const { sent, dataProvider } = fakeApi(() => ({
      body: { data: [], total: 0 },
    }));

    await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 25 },
      sort: { field: "last_seen", order: "DESC" },
      filter: { q: "ada", status: "hot" },
    });

    expect(filterOf(sent[0])).toEqual({
      status: "hot",
      "@or": {
        "first_name@ilike": "ada",
        "last_name@ilike": "ada",
        "company_name@ilike": "ada",
        "title@ilike": "ada",
        "email_fts@ilike": "ada",
        "phone_fts@ilike": "ada",
        "background@ilike": "ada",
      },
    });
  });

  it("fetches several records by id in one request", async () => {
    const { sent, dataProvider } = fakeApi(() => ({
      body: { data: [{ id: 3 }, { id: 5 }], total: 2 },
    }));

    const { data } = await dataProvider.getMany("tags", { ids: [3, 5] });

    expect(data).toEqual([{ id: 3 }, { id: 5 }]);
    expect(sent).toHaveLength(1);
    expect(filterOf(sent[0])).toEqual({ "id@in": "(3,5)" });
  });

  it("names activity log entries the way the activity screens read them", async () => {
    const { dataProvider } = fakeApi(() => ({
      body: {
        data: [
          {
            id: "contactNote.1.created",
            type: "contactNote.created",
            contact_note: { id: 1, text: "Hi" },
            deal_note: null,
          },
        ],
        total: 1,
      },
    }));

    const { data } = await dataProvider.getList("activity_log", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "date", order: "DESC" },
      filter: {},
    });

    expect(data[0]).toMatchObject({
      type: "contactNote.created",
      contactNote: { id: 1, text: "Hi" },
    });
    expect(data[0]).not.toHaveProperty("contact_note");
  });

  it("uploads a note's attached file and keeps a link to it in the note", async () => {
    const { sent, dataProvider } = fakeApi(({ url, body }) =>
      url.pathname === "/api/crm/files"
        ? {
            status: 201,
            body: {
              data: {
                src: "/api/crm/files/f1",
                title: "notes.txt",
                type: "text/plain",
                path: "f1",
              },
            },
          }
        : { status: 201, body: { data: { id: 9, ...body } } },
    );

    await dataProvider.create("contact_notes", {
      data: {
        contact_id: 1,
        text: "See attached",
        attachments: [
          {
            src: "blob:local",
            title: "notes.txt",
            rawFile: new File(["hello"], "notes.txt", { type: "text/plain" }),
          },
        ],
      },
    });

    expect(sent.map((request) => request.url.pathname)).toEqual([
      "/api/crm/files",
      "/api/crm/contact_notes",
    ]);
    expect(sent[1].body.attachments).toEqual([
      {
        src: "/api/crm/files/f1",
        title: "notes.txt",
        type: "text/plain",
        path: "f1",
      },
    ]);
  });

  it("reports the server's refusal with its status and message", async () => {
    const { dataProvider } = fakeApi(() => ({
      status: 403,
      body: { error: "Only an admin can change this." },
    }));

    const failure = dataProvider.update("configuration", {
      id: 1,
      data: { config: {} },
      previousData: { id: 1 },
    });

    await expect(failure).rejects.toBeInstanceOf(HttpError);
    await expect(failure).rejects.toMatchObject({
      status: 403,
      message: "Only an admin can change this.",
    });
  });

  it("searches everything through the server's global search", async () => {
    const results = [
      { resource: "contacts", record_id: 4, title: "Ada Lovelace" },
    ];
    const { sent, dataProvider } = fakeApi(() => ({ body: { data: results } }));

    await expect(
      dataProvider.globalSearch("ada", ["contacts", "deals"], 5),
    ).resolves.toEqual(results);
    expect(Object.fromEntries(sent[0].url.searchParams)).toEqual({
      q: "ada",
      resources: "contacts,deals",
      max: "5",
    });
  });
});
