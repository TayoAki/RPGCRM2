# Modules: the CRM builds what a customer asks for

A customer asks the assistant for something the CRM doesn't track yet, such as "track daily fuel prices", "show margin on every order" or "turn order emails into order sheets". They get a working part of the CRM: where the data lives, how it gets in, and how it's shown. They see what will be made and approve it first.

## What a module is

A module is a saved spec, not generated code. It's built only from pieces the CRM already knows how to run, so permissions, the API, exports and upgrades keep working. A person reviews it as a readable list of changes, and removing the module removes everything it made.

| Piece | What it is | Today |
|---|---|---|
| **Objects and fields** | Where the data lives | Custom objects and 14 field types exist (`server/src/crm/metadata.ts`). Missing: formula fields and a rich-text field. The assistant can't create objects or fields. |
| **Feeds** | How data gets in | Workflows have schedule, webhook and record triggers, plus `http_request`, `classify` and AI steps (`server/src/crm/workflows/`). Routines run the assistant on a cron with its computer. Missing: an `extract` step, `create_record` on custom objects, Python on the computer, and a path from a routine into CRM records. |
| **Views and dashboards** | How it's shown | Table, board and calendar views; dashboards with one aggregate per chart (number, bar, line, pie, list), drawn with Recharts. Missing: several series, and ratios such as margin %. |
| **Documents** | Editable write-ups tied to a record | Proposals are edited in a TipTap editor (`src/extensions/editor/RichTextEditor.tsx`) and stored as Markdown. Missing: a rich-text field type and document templates. |
| **Panels** | Anything the fixed pieces can't show | OpenDuet's assistant already draws charts, tables, metrics and forms in chat (`app/src/components/gallery/`), CopilotKit's A2UI, and open generative UI in a sandboxed frame. They disappear into the chat thread. Make pages are saved but are static snapshots. |

## The four examples

**Daily fuel prices.** A *Fuel price* object (date, region, price per litre) and a line chart on a dashboard. Data gets in one of two ways:
- If the source is a JSON API, no code is needed: a schedule trigger, an HTTP request, and *create record* for each row.
- If the source needs scraping or cleaning, the assistant writes a Python script. It runs on a schedule on the assistant's computer and posts rows to the CRM with a key that can only write that object.

Gaps:
- *create record* doesn't work on custom objects yet.
- The computer image has no Python.
- A routine has no built-in way to write CRM records.

**Margin and profit.** Formula fields on *Order*: `margin = revenue - cost` and `margin % = margin / revenue`. Reports also need a ratio of sums, `sum(margin) / sum(revenue)`, and several series in one chart (revenue and cost by month). Today a report is one aggregate per chart.

**Order intake from email.** An *Order* object, and a workflow on new email:
1. An `extract` step fills the order's fields from the message and checks them against the object's field types.
2. A record is created, with a document drafted from a template.
3. The person edits the document in the CRM.

Two gaps: mail from senders who aren't contacts is dropped today, and there's no extract step. **TipTap: yes.** It's headless and ProseMirror-based and fits our shadcn components. It reads and writes Markdown, so documents stay readable by the assistant and render anywhere the CRM shows Markdown. Proposals already use it.

**Financial data and charts.**
- **Connections:** QuickBooks, Xero and Stripe arrive as connector feeds. OpenDuet already has Composio and Arcade adapters to build on.
- **Charts: use Recharts**, through shadcn/ui's chart component, which is built on Recharts and matches the CRM's look. Pie charts, stacked bars, several series and tooltips then need no new code. Don't add Chart.js or ApexCharts to the CRM: one library is easier to keep consistent. Chart.js stays only inside the sandboxed generative UI, where the assistant already loads it.
- **Retire:** the stock `@nivo/bar` deal chart. The hand-drawn dashboard charts are gone.

## Is dynamic UI with CopilotKit doable?

Yes, and half of it exists. "We supply the elements" is right: the elements are OpenDuet's gallery components plus CRM views and charts. Two things are missing:
1. **Saving a composition.** The assistant needs to save what it builds into the CRM (a dashboard, an object page or a panel) instead of only drawing it in chat.
2. **Live data.** Each element should name a query (object, filter, measure, group) that runs with the viewer's permissions, rather than holding a copy of the numbers.

For anything the gallery can't express, a panel can be a sandboxed component (HTML and JS, already in OpenDuet) that gets its data only through those declared queries. It never gets the API directly.

## Phases

Each phase is useful on its own, in this order:

| Phase | Builds | Done when |
|---|---|---|
| **M1. The assistant shapes the data model** | Tools to propose objects, fields and views, applied after approval. Record tools and workflow *create record* for custom objects. Formula fields. | "Track our delivery sites with region and capacity" ends with a working object, a table view and the assistant adding rows. |
| **M2. Feeds** | A scheduled HTTP-pull recipe, the `extract` step, capture of mail from unknown senders into an inbox object, Python on the computer, and scoped keys that let a routine write one object. | Fuel prices arrive every morning without anyone opening the CRM. |
| **M3. Charts** | Several series, ratio measures, and dashboards pinned to object pages. Recharts and pie charts are done. | A margin % by month chart on the Orders page. |
| **M4. Documents** | A rich-text field, document templates, and email to document. The TipTap editor is done and used for proposals. | An order email becomes an order and an editable order sheet. |
| **M5. Modules as a unit** | The module spec, a reviewable list of changes before install, uninstall, starter modules ("Fuel prices", "Order intake", "Margin tracking"), and custom panels bound to queries. | A customer installs "Order intake" in one approval and removes it in one click. |
