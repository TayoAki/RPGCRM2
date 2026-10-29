# Magpie CRM: what's in the app

Every area a person can reach, what each screen does, and who sees it. It's the starting point for the UI rework. Feature status lives in [FEATURES.md](FEATURES.md).

**Who:** **Everyone** is any signed-in person. **Admin** is a workspace admin. **Operator** is you, running Magpie.

## 1. Sign-up site (one for all customers)

| Screen | What it does | Who |
|---|---|---|
| Landing page | Explains Magpie and links to sign-up | Public |
| Create your workspace | Company, name, work email, workspace address | Public |
| Setting up / ready | Live progress, then the sign-in email, Set your password and the CRM's address | The person who signed up, in that browser |
| Find your workspace | Type the workspace address, go to its sign-in | Public |

Behind it, per sign-up: a Railway project with the CRM app and its database. Shared keys (OpenAI, Intelligence, Composio) are pushed in and kept current. New releases roll out when `WORKSPACE_IMAGE` changes.

## 2. Getting in

| Screen | What it does | Who |
|---|---|---|
| Sign in | Email and password, or single sign-on where the company set it up | Everyone |
| Set password | Opened from a link an admin made, or from the sign-up page | New people |
| Onboarding | First run: a short intro, Connect your apps, Get notified, then Check your setup | Everyone, first time |

## 3. The assistant (OpenDuet)

The bottom tabs on phones, and the main area on desktop.

| Area | What it does | Who |
|---|---|---|
| **Chat** | One ongoing conversation with the main Bot. It answers, uses tools, asks before risky actions, and can draw charts, tables and forms | Everyone |
| Start | Message any other Bot, picked with `@` | Everyone |
| Groups | A conversation with several Bots and people | Everyone |
| **Tasks** | Work the Bots are doing or did: Needs input, In progress, Resolved. Questions a Bot asked land here | Everyone |
| Approvals | Requests waiting for your yes or no, such as a CRM write or sending an email | Everyone |
| **Make** | Make docs, slides, dashboards, designs and web pages with a Bot, and keep them as pages | Everyone |
| **Bots** | Each Bot's page: setup, what it can use, approvals, memory, how it reaches you, responsibilities, routines, sharing | Everyone (own); admin (all) |
| Team Bots | Bots shared with the whole team | Everyone |
| **Connections** | Your own accounts: Gmail and Calendar (built-in), apps through Composio, Slack, GitHub | Everyone |
| **Capabilities** | Your skills (instructions you call with `/`) and what Bots remember about you | Everyone |
| **Routines** | Things a Bot does for you on a schedule, with a switch to stop each one | Everyone |
| Responsibilities | Ongoing duties a Bot owns, started by events | Everyone |
| Reaching you | Push, SMS and Slack links, so a Bot can reach you away from the app | Everyone |
| Approval rules | What a Bot may do without asking you each time | Everyone |
| Settings | Appearance, notifications, saved passwords, memory, Check your setup | Everyone |
| Morning brief | Each morning: mail that needs you, today's calendar, and a Follow up section from the CRM. Reads Gmail and Calendar through the built-in connector, or through Composio, or a CRM mailbox | Everyone with mail connected |

## 4. The CRM (`/crm`)

Desktop frame:
- an icon rail: home, search, notifications, reports, automations, settings;
- a sidebar of records and saved views;
- tabs for the current section;
- a Today panel: tasks due, meetings coming up, deals that moved;
- a status bar.

Phones get a compact header.

| Area | What it does | Who |
|---|---|---|
| **Dashboard** (home) | Atomic's home page: deals chart, latest notes, tasks | Everyone |
| **Contacts** | List, record page with notes, tasks, email, meetings, history; tags; merge duplicates; import and export CSV | Everyone, by role |
| **Companies** | List and record page with people, deals and notes | Everyone, by role |
| **Deals** | Pipeline board by stage, list, record page, proposals on the deal | Everyone, by role |
| **Meetings** | Upcoming meetings, booking webhook, call outcome form | Everyone, by role |
| **Tasks** | To-dos on contacts, due dates, reminders | Everyone, by role |
| **Proposals** | Drafted by AI from the deal, edited in the rich-text editor, sent by email, with a public page the client accepts or declines | Everyone, by role |
| **All records** | Custom objects and every standard one as Table, Board and Calendar, with saved views (personal or shared) | Everyone, by role |
| Search | Across contacts, companies, deals and notes | Everyone |
| **Reports** | Pages of charts: number, bars, columns, line, pie, list, with filters; personal or shared | Everyone |
| **Automations** | Workflows: triggers (record change, date, schedule, webhook, manual) and steps (records, conditions, delay, email, HTTP, AI steps, classify, meeting, and more), with run history | Admin builds; Run menu for everyone |
| Ask the agent | On a contact, company or deal: type an ask, a Bot works on it knowing the record | Everyone |
| Settings, General | Company details, stages, categories, branding colour | Admin |
| Settings, Data model | Custom fields and custom objects | Admin |
| Settings, Roles | Roles with object and field permissions | Admin |
| Settings, Sign-in | Single sign-on providers and SCIM tokens | Admin |
| Settings, People | Add people, give roles, make set-password links, turn people off | Admin |
| Settings, API keys | Keys for the public API | Everyone (own keys) |
| Profile | Your name, avatar, password | Everyone |
| Mailboxes | Connect a mailbox (IMAP/SMTP) to send and log email | Everyone |
| Public proposal page | What a client sees: the proposal, Accept and Decline | Public, by link |

## 5. Admin (OpenDuet)

| Screen | What it does | Who |
|---|---|---|
| People | Who's in the workspace, their role, set-password links | Admin |
| Identity providers, Enterprise controls | Sign-in rules and company-wide policies | Admin |
| Credentials | The model key and other secrets Bots use | Admin |
| **Plugins** | Turn apps on and give their tools to Bots: Composio (hundreds of apps), the built-in Gmail and Calendar, Drive, Notion, web research (Parallel, Exa, Firecrawl), the CRM's own tools | Admin |
| Skills, Components, Playground | Team skills, and the building blocks Bots draw with | Admin |
| Computers, Boundaries | The Bots' browser computers and what they may do on them | Admin |
| Approvals | Requests for access people sent | Admin |
| Audit | Every Bot action and approval, and record changes | Admin |
| Automatic learning | Bots learning skills from conversations (off on customer workspaces) | Admin |
| Check your setup | Intelligence, AI model, Google, your Gmail, notifications, Bot computer, More apps (Composio), Slack and Teams | Admin and everyone |

## 6. Coming soon on customer workspaces

| Feature | Why | Plan |
|---|---|---|
| Built-in Gmail and Calendar (Google apps) | Needs your own Google app, Google's review and a shared return address | [platform/OAUTH_RELAY.md](platform/OAUTH_RELAY.md). Composio covers Gmail meanwhile |
| Slack and Teams (chatting with Bots there) | Needs OpenTag plus each company's own Slack app | OpenTag per company's Railway project |

## 7. Overlaps to sort out in the UI rework

- **Two settings areas.** OpenDuet's Settings and Admin, and the CRM's Settings, each have a People screen and sign-in settings.
- **Two dashboards.** The CRM's home dashboard (fixed) and Reports (configurable). Make can also build dashboards.
- **Approvals in three places:** Approvals, Approval rules, and Admin, Approvals.
- **Three ways to connect mail:** Connections (built-in Gmail), Composio Gmail and CRM Mailboxes.
- **Two task lists:** the assistant's Tasks are Bot work, the CRM's Tasks are to-dos on contacts. Same word, different things.
- **Two homes.** Chat is the app's front door, and the CRM has its own home. People switch between them with the CRM button.
