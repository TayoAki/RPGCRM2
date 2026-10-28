import type { WorkflowInput } from "./definition";

/** What a ready-made automation needs before it can do its job. */
export type Requirement = "mailbox" | "model" | "bot";

export type Recipe = WorkflowInput & {
  key: string;
  needs: Requirement[];
};

/** The outcomes the call outcome form offers until an admin changes them in Settings. */
export const DEFAULT_MEETING_OUTCOMES = [
  "Send proposal",
  "Interested",
  "Follow up later",
  "Not a fit",
  "No show",
];

export const DEFAULT_LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cal.com",
  "Calendly",
  "LinkedIn",
  "Google Ads",
  "Event",
  "Cold outreach",
  "Other",
];

const changedTo = (field: string, value: string) => ({
  match: "all" as const,
  conditions: [
    { field: `record.${field}`, op: "changed" as const },
    { field: `record.${field}`, op: "is" as const, value },
  ],
});

const outcomeIs = (value: string) => changedTo("outcome", value);

const repliedOrAnswered = {
  match: "any" as const,
  conditions: [
    { field: "proposal.status", op: "in" as const, value: "accepted,declined" },
    {
      field: "contact.last_email_received_at",
      op: "after" as const,
      value: "{{proposal.sent_at}}",
    },
  ],
};

// Opens a deal for the meeting's contact when the meeting has none. Ids end in `suffix`.
const meetingDeal = (suffix: string) => [
  {
    id: `no_deal_yet${suffix}`,
    type: "if" as const,
    when: {
      match: "all" as const,
      conditions: [{ field: "deal", op: "is_empty" as const }],
    },
    if_true: [
      {
        id: `create_deal${suffix}`,
        type: "create_record" as const,
        object: "deals" as const,
        values: {
          name: "{{company.name | default:contact.name}}",
          stage: "opportunity",
          contact_ids: ["{{contact.id}}"],
          company_id: "{{company.id}}",
          sales_id: "{{meeting.sales_id}}",
        },
      },
      {
        id: `link_meeting${suffix}`,
        type: "update_record" as const,
        target: "meeting" as const,
        values: { deal_id: "{{deal.id}}" },
      },
    ],
    if_false: [],
  },
];

/**
 * Ready-made automations, each made once per deployment, switched off. An admin reads one, changes
 * what it says, and switches it on. "Date updated" is not here: the database keeps it on every record.
 */
export const RECIPES: Recipe[] = [
  {
    key: "booking-updates-crm",
    name: "When someone books a meeting, update the CRM",
    description:
      "A booking from Cal.com, Calendly or your website adds the contact and the meeting. This opens a deal if they have none, marks them a prospect, gives the owner a task to prepare, and asks the Bot to research them before the call.",
    needs: ["bot"],
    enabled: false,
    trigger: {
      type: "record",
      object: "meetings",
      on: ["created"],
      when: {
        match: "all",
        conditions: [
          {
            field: "record.source",
            op: "in",
            value: "calcom,calendly,webhook",
          },
        ],
      },
    },
    steps: [
      ...meetingDeal(""),
      {
        id: "prospect",
        type: "if",
        when: {
          match: "all",
          conditions: [
            { field: "contact.lifecycle_stage", op: "is", value: "lead" },
          ],
        },
        if_true: [
          {
            id: "mark_prospect",
            type: "update_record",
            target: "contact",
            values: { lifecycle_stage: "prospect" },
          },
        ],
        if_false: [],
      },
      {
        id: "prepare",
        type: "create_task",
        text: "Prepare for {{meeting.title}} with {{contact.name}} on {{meeting.start_at | datetime}}",
        task_type: "meeting",
        due_in_days: 0,
      },
      {
        id: "research",
        type: "ai_agent",
        instructions:
          "{{contact.name}} ({{contact.email}}) booked {{meeting.title}} for {{meeting.start_at | datetime}}. Research them and their company on the web. Add a short note to the contact with what matters for the call: who they are, what the company does, and two good questions to ask.",
      },
    ],
  },
  {
    key: "pre-call-reminder",
    name: "Remind people before their call",
    description:
      "Emails the contact a day before a scheduled meeting, and again an hour before if it is still on.",
    needs: ["mailbox"],
    enabled: false,
    trigger: {
      type: "date",
      object: "meetings",
      field: "start_at",
      offset_minutes: -1440,
      when: {
        match: "all",
        conditions: [{ field: "record.status", op: "is", value: "scheduled" }],
      },
    },
    steps: [
      {
        id: "day_before",
        type: "send_email",
        to: "{{contact.email}}",
        subject: "Tomorrow: {{meeting.title}}",
        body: "Hi {{contact.first_name | default:\"there\"}},\n\nA quick reminder that we're meeting tomorrow, {{meeting.start_at | datetime}}.\n\n{{meeting.location}}\n\nIf the time no longer works, just reply and we'll find another.\n\n{{owner.first_name}}",
        review_first: false,
      },
      {
        id: "until_hour_before",
        type: "delay",
        amount: 0,
        unit: "hours",
        until: "{{meeting.start_at | add_hours:-1}}",
      },
      {
        id: "still_on",
        type: "if",
        when: {
          match: "all",
          conditions: [
            { field: "meeting.status", op: "is", value: "scheduled" },
          ],
        },
        if_true: [
          {
            id: "hour_before",
            type: "send_email",
            to: "{{contact.email}}",
            subject: "In an hour: {{meeting.title}}",
            body: 'Hi {{contact.first_name | default:"there"}},\n\nTalk soon: we\'re on at {{meeting.start_at | time}}.\n\n{{meeting.location}}\n\n{{owner.first_name}}',
            review_first: false,
          },
        ],
        if_false: [],
      },
    ],
  },
  {
    key: "call-outcome-updates",
    name: "When a call's outcome is logged, update the CRM",
    description:
      "From the call outcome form: marks the meeting done or a no-show, moves the deal, notes the outcome on the contact, and adds the next task.",
    needs: [],
    enabled: false,
    trigger: {
      type: "record",
      object: "meetings",
      on: ["updated"],
      when: {
        match: "all",
        conditions: [
          { field: "record.outcome", op: "changed" },
          { field: "record.outcome", op: "is_not_empty" },
        ],
      },
    },
    steps: [
      {
        id: "no_show",
        type: "if",
        when: {
          match: "all",
          conditions: [
            { field: "meeting.outcome", op: "is", value: "No show" },
          ],
        },
        if_true: [
          {
            id: "mark_no_show",
            type: "update_record",
            target: "meeting",
            values: { status: "no_show" },
          },
          {
            id: "rebook_task",
            type: "create_task",
            text: "{{contact.name}} missed {{meeting.title}}: offer a new time",
            task_type: "call",
            due_in_days: 1,
          },
        ],
        if_false: [
          {
            id: "mark_done",
            type: "update_record",
            target: "meeting",
            values: { status: "completed" },
          },
          {
            id: "note_outcome",
            type: "add_note",
            target: "contact",
            text: "{{meeting.title}}: {{meeting.outcome}}. {{meeting.outcome_notes}}",
          },
        ],
      },
      {
        id: "not_a_fit",
        type: "if",
        when: {
          match: "all",
          conditions: [
            { field: "meeting.outcome", op: "is", value: "Not a fit" },
          ],
        },
        if_true: [
          {
            id: "lose_deal",
            type: "update_record",
            target: "deal",
            values: { stage: "lost" },
          },
          {
            id: "cold",
            type: "update_record",
            target: "contact",
            values: { status: "cold" },
          },
        ],
        if_false: [],
      },
      {
        id: "warm_up",
        type: "if",
        when: {
          match: "all",
          conditions: [
            {
              field: "meeting.outcome",
              op: "in",
              value: "Send proposal,Interested",
            },
          ],
        },
        if_true: [
          {
            id: "hot",
            type: "update_record",
            target: "contact",
            values: { status: "hot" },
          },
          {
            id: "negotiate",
            type: "update_record",
            target: "deal",
            values: { stage: "in-negociation" },
          },
        ],
        if_false: [],
      },
      {
        id: "later",
        type: "if",
        when: {
          match: "all",
          conditions: [
            { field: "meeting.outcome", op: "is", value: "Follow up later" },
          ],
        },
        if_true: [
          {
            id: "later_task",
            type: "create_task",
            text: "Follow up with {{contact.name}} after {{meeting.title}}",
            task_type: "follow-up",
            due_in_days: 30,
          },
        ],
        if_false: [],
      },
    ],
  },
  {
    key: "outcome-follow-up",
    name: "Send a follow-up email that fits the call's outcome",
    description:
      "After a call, the model writes a thank-you and recap, a gentle close for a poor fit, or a new-time offer for a no-show. Proposals have their own email.",
    needs: ["mailbox", "model"],
    enabled: false,
    trigger: {
      type: "record",
      object: "meetings",
      on: ["updated"],
      when: {
        match: "all",
        conditions: [
          { field: "record.outcome", op: "changed" },
          {
            field: "record.outcome",
            op: "in",
            value: "Interested,Follow up later,Not a fit,No show",
          },
        ],
      },
    },
    steps: [
      {
        id: "wait_a_bit",
        type: "delay",
        amount: 30,
        unit: "minutes",
      },
      {
        id: "follow_up",
        type: "send_email",
        to: "{{contact.email}}",
        subject: "Following up on {{meeting.title}}",
        body: 'Hi {{contact.first_name | default:"there"}},',
        ai_instructions:
          "The call's outcome was \"{{meeting.outcome}}\". Notes: {{meeting.outcome_notes}}. If they were interested, thank them, recap what we discussed in two or three lines and give the next step. If they want to talk later, thank them and say you'll be in touch. If it isn't a fit, thank them warmly and leave the door open. If they didn't show up, say no problem and offer to find a new time. Keep it under 120 words.",
        review_first: false,
      },
    ],
  },
  {
    key: "post-call-proposal-due",
    name: "After a call, say when the proposal is coming",
    description:
      'When a call ends with "Send proposal", emails the contact to thank them and say the proposal will arrive within two working days.',
    needs: ["mailbox", "model"],
    enabled: false,
    trigger: {
      type: "record",
      object: "meetings",
      on: ["updated"],
      when: outcomeIs("Send proposal"),
    },
    steps: [
      {
        id: "proposal_due",
        type: "send_email",
        to: "{{contact.email}}",
        subject: "Your proposal is on its way",
        body: 'Hi {{contact.first_name | default:"there"}},\n\nThanks for your time today. You\'ll have our proposal by {{now | add_days:2 | date}}.',
        ai_instructions:
          "Thank them for the call, recap in one line what they need (from the notes: {{meeting.outcome_notes}}), and say the proposal will arrive by {{now | add_days:2 | date}}. Keep it under 90 words.",
        review_first: false,
      },
    ],
  },
  {
    key: "proposal-generation",
    name: "Write a proposal after a call",
    description:
      'When a call ends with "Send proposal", the model drafts a proposal from the deal, the call notes and your proposal template, and the owner gets a task to review it.',
    needs: ["model"],
    enabled: false,
    trigger: {
      type: "record",
      object: "meetings",
      on: ["updated"],
      when: outcomeIs("Send proposal"),
    },
    steps: [
      ...meetingDeal(""),
      {
        id: "draft",
        type: "generate_proposal",
        instructions: "{{meeting.outcome_notes}}",
      },
      {
        id: "review",
        type: "create_task",
        text: "Review the proposal for {{deal.name}} and mark it ready to send",
        task_type: "email",
        due_in_days: 1,
      },
    ],
  },
  {
    key: "delayed-proposal-delivery",
    name: "Send a proposal a while after it's approved",
    description:
      "When a proposal is marked ready, waits two hours so it doesn't land the moment the call ends, then emails the client their link.",
    needs: ["mailbox"],
    enabled: false,
    trigger: {
      type: "record",
      object: "proposals",
      on: ["updated"],
      when: changedTo("status", "ready"),
    },
    steps: [
      { id: "wait", type: "delay", amount: 2, unit: "hours" },
      {
        id: "send",
        type: "send_proposal",
        subject: "Your proposal: {{proposal.title}}",
        body: 'Hi {{contact.first_name | default:"there"}},\n\nAs promised, here is our proposal:\n\n{{proposal.url}}\n\nYou can read it and accept it on that page. Happy to answer any questions.\n\n{{owner.first_name}}',
      },
    ],
  },
  {
    key: "proposal-follow-ups",
    name: "Follow up on a proposal until they answer",
    description:
      "After a proposal goes out: moves the deal to Proposal sent, then follows up after 3 and 7 days unless they replied or answered, and finally asks the owner to call.",
    needs: ["mailbox", "model"],
    enabled: false,
    trigger: {
      type: "record",
      object: "proposals",
      on: ["updated"],
      when: changedTo("status", "sent"),
    },
    steps: [
      {
        id: "stage",
        type: "update_record",
        target: "deal",
        values: { stage: "proposal-sent" },
      },
      { id: "wait_3_days", type: "delay", amount: 3, unit: "days" },
      {
        id: "check_1",
        type: "if",
        when: repliedOrAnswered,
        if_true: [{ id: "done_1", type: "stop" }],
        if_false: [],
      },
      {
        id: "follow_up_1",
        type: "send_email",
        to: "{{contact.email}}",
        subject: "Re: {{proposal.title}}",
        body: 'Hi {{contact.first_name | default:"there"}},',
        ai_instructions:
          "A short, friendly check-in on the proposal we sent on {{proposal.sent_at | date}} ({{proposal.url}}). Ask if they had a chance to read it and offer a quick call. Under 70 words.",
        review_first: false,
      },
      { id: "wait_4_days", type: "delay", amount: 4, unit: "days" },
      {
        id: "check_2",
        type: "if",
        when: repliedOrAnswered,
        if_true: [{ id: "done_2", type: "stop" }],
        if_false: [],
      },
      {
        id: "follow_up_2",
        type: "send_email",
        to: "{{contact.email}}",
        subject: "Re: {{proposal.title}}",
        body: 'Hi {{contact.first_name | default:"there"}},',
        ai_instructions:
          "A last, polite follow-up on the proposal ({{proposal.url}}). Mention it's still open, offer to adjust it, and make it easy to say no. Under 60 words.",
        review_first: false,
      },
      { id: "wait_7_days", type: "delay", amount: 7, unit: "days" },
      {
        id: "check_3",
        type: "if",
        when: repliedOrAnswered,
        if_true: [{ id: "done_3", type: "stop" }],
        if_false: [],
      },
      {
        id: "call_task",
        type: "create_task",
        text: "No answer on {{proposal.title}}: call {{contact.name}}",
        task_type: "call",
        due_in_days: 0,
      },
    ],
  },
  {
    key: "proposal-accepted",
    name: "When a proposal is accepted, win the deal",
    description:
      "Moves the deal to Won when the client accepts on their proposal link.",
    needs: [],
    enabled: false,
    trigger: {
      type: "record",
      object: "proposals",
      on: ["updated"],
      when: changedTo("status", "accepted"),
    },
    steps: [
      {
        id: "win",
        type: "update_record",
        target: "deal",
        values: { stage: "won" },
      },
    ],
  },
  {
    key: "won-deal-to-clients",
    name: "Move a won deal into the client list",
    description: "When a deal is won, its company and contacts become clients.",
    needs: [],
    enabled: false,
    trigger: {
      type: "record",
      object: "deals",
      on: ["updated"],
      when: changedTo("stage", "won"),
    },
    steps: [
      {
        id: "company_client",
        type: "update_record",
        target: "company",
        values: { lifecycle_stage: "client" },
      },
      {
        id: "contacts_client",
        type: "update_record",
        target: "contacts",
        values: { lifecycle_stage: "client", status: "in-contract" },
      },
    ],
  },
  {
    key: "welcome-new-customer",
    name: "Welcome a new customer",
    description:
      "When a deal is won, the model writes a warm welcome email to the contact with what happens next.",
    needs: ["mailbox", "model"],
    enabled: false,
    trigger: {
      type: "record",
      object: "deals",
      on: ["updated"],
      when: changedTo("stage", "won"),
    },
    steps: [
      {
        id: "welcome",
        type: "send_email",
        to: "{{contact.email}}",
        subject:
          'Welcome aboard, {{contact.first_name | default:"and thank you"}}!',
        body: 'Hi {{contact.first_name | default:"there"}},',
        ai_instructions:
          'Welcome them as a new customer for "{{deal.name}}". Thank them for choosing us, say what happens next (a kickoff in the coming days) and how to reach the sender. Warm and specific, under 120 words.',
        review_first: false,
      },
    ],
  },
  {
    key: "lead-source-from-forms",
    name: "Capture website leads with their source",
    description:
      'Gives you an address for your website\'s contact form. Each submission becomes a contact with where they came from (utm_source and utm_campaign, or "Website"), and the owner gets a task.',
    needs: [],
    enabled: false,
    trigger: { type: "webhook" },
    steps: [
      {
        id: "contact",
        type: "upsert_contact",
        email: "{{trigger.payload.email}}",
        first_name:
          "{{trigger.payload.first_name | default:trigger.payload.name}}",
        last_name: "{{trigger.payload.last_name}}",
        phone: "{{trigger.payload.phone}}",
        company_name: "{{trigger.payload.company}}",
        lead_source: '{{trigger.payload.utm_source | default:"Website"}}',
        lead_source_detail:
          "{{trigger.payload.utm_campaign | default:trigger.payload.page}}",
      },
      {
        id: "note",
        type: "add_note",
        target: "contact",
        text: "From the website form: {{trigger.payload.message}}",
      },
      {
        id: "call_back",
        type: "create_task",
        text: "New website lead: reply to {{contact.name}}",
        task_type: "email",
        due_in_days: 0,
      },
    ],
  },
];
