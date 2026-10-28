import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client";
import { isEmailAddress } from "./mail";
import { CrmRefusal } from "./refusal";
import { fields, objects, records } from "./schema";

export const FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "currency",
  "date",
  "datetime",
  "boolean",
  "select",
  "multi_select",
  "email",
  "phone",
  "url",
  "rating",
  "relation",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type Choice = { value: string; label: string; color?: string };
export type FieldOptions = {
  choices?: Choice[];
  target?: string;
  currency?: string;
};

export type FieldDefinition = {
  object: string;
  name: string;
  label: string;
  type: FieldType;
  options: FieldOptions;
  required: boolean;
  position: number;
  standard: boolean;
};

export type ObjectDefinition = {
  name: string;
  label_singular: string;
  label_plural: string;
  description: string;
  icon: string | null;
  standard: boolean;
  in_navigation: boolean;
};

type Standard = Omit<ObjectDefinition, "standard" | "description"> & {
  fields: [string, string, FieldType, FieldOptions?][];
};

// The standard objects and the columns worth describing (for views, roles and the API).
const STANDARD: Standard[] = [
  {
    name: "contacts",
    label_singular: "Contact",
    label_plural: "Contacts",
    icon: "users",
    in_navigation: false,
    fields: [
      ["first_name", "First name", "text"],
      ["last_name", "Last name", "text"],
      ["title", "Title", "text"],
      ["company_id", "Company", "relation", { target: "companies" }],
      ["status", "Status", "text"],
      ["lifecycle_stage", "Lifecycle stage", "text"],
      ["lead_source", "Lead source", "text"],
      ["lead_source_detail", "Campaign or referrer", "text"],
      ["background", "Background", "long_text"],
      ["linkedin_url", "LinkedIn", "url"],
      ["first_seen", "First seen", "datetime"],
      ["last_seen", "Last seen", "datetime"],
      ["updated_at", "Date updated", "datetime"],
      ["sales_id", "Owner", "relation", { target: "sales" }],
    ],
  },
  {
    name: "companies",
    label_singular: "Company",
    label_plural: "Companies",
    icon: "building",
    in_navigation: false,
    fields: [
      ["name", "Name", "text"],
      ["sector", "Sector", "text"],
      ["website", "Website", "url"],
      ["phone_number", "Phone", "phone"],
      ["city", "City", "text"],
      ["country", "Country", "text"],
      ["lifecycle_stage", "Lifecycle stage", "text"],
      ["lead_source", "Lead source", "text"],
      ["revenue", "Revenue", "text"],
      ["description", "Description", "long_text"],
      ["created_at", "Created", "datetime"],
      ["updated_at", "Date updated", "datetime"],
      ["sales_id", "Owner", "relation", { target: "sales" }],
    ],
  },
  {
    name: "deals",
    label_singular: "Deal",
    label_plural: "Deals",
    icon: "handshake",
    in_navigation: false,
    fields: [
      ["name", "Name", "text"],
      ["stage", "Stage", "text"],
      ["amount", "Amount", "currency"],
      ["company_id", "Company", "relation", { target: "companies" }],
      ["lead_source", "Lead source", "text"],
      ["expected_closing_date", "Expected closing", "date"],
      ["description", "Description", "long_text"],
      ["created_at", "Created", "datetime"],
      ["updated_at", "Date updated", "datetime"],
      ["sales_id", "Owner", "relation", { target: "sales" }],
    ],
  },
  {
    name: "meetings",
    label_singular: "Meeting",
    label_plural: "Meetings",
    icon: "calendar",
    in_navigation: false,
    fields: [
      ["title", "Title", "text"],
      ["start_at", "Starts", "datetime"],
      ["end_at", "Ends", "datetime"],
      ["status", "Status", "text"],
      ["outcome", "Outcome", "text"],
      ["outcome_notes", "Outcome notes", "long_text"],
      ["location", "Where", "text"],
      ["contact_id", "Contact", "relation", { target: "contacts" }],
      ["deal_id", "Deal", "relation", { target: "deals" }],
      ["source", "Booked through", "text"],
      ["updated_at", "Date updated", "datetime"],
      ["sales_id", "Owner", "relation", { target: "sales" }],
    ],
  },
  {
    name: "proposals",
    label_singular: "Proposal",
    label_plural: "Proposals",
    icon: "file-text",
    in_navigation: false,
    fields: [
      ["title", "Title", "text"],
      ["status", "Status", "text"],
      ["amount", "Amount", "currency"],
      ["deal_id", "Deal", "relation", { target: "deals" }],
      ["sent_at", "Sent", "datetime"],
      ["viewed_at", "Opened", "datetime"],
      ["accepted_at", "Accepted", "datetime"],
      ["valid_until", "Valid until", "date"],
      ["updated_at", "Date updated", "datetime"],
      ["sales_id", "Owner", "relation", { target: "sales" }],
    ],
  },
  {
    name: "tasks",
    label_singular: "Task",
    label_plural: "Tasks",
    icon: "check-square",
    in_navigation: false,
    fields: [
      ["text", "Task", "text"],
      ["type", "Type", "text"],
      ["due_date", "Due", "datetime"],
      ["done_date", "Done", "datetime"],
      ["contact_id", "Contact", "relation", { target: "contacts" }],
      ["updated_at", "Date updated", "datetime"],
      ["sales_id", "Owner", "relation", { target: "sales" }],
    ],
  },
];

export const STANDARD_OBJECTS = STANDARD.map((object) => object.name);
// Objects whose records have a custom_fields column.
export const EXTENSIBLE = new Set([
  "contacts",
  "companies",
  "deals",
  "meetings",
  "proposals",
]);
// Names a custom object can't take: the API's own resources.
const RESERVED = new Set([
  ...STANDARD_OBJECTS,
  "contacts_summary",
  "companies_summary",
  "contact_notes",
  "deal_notes",
  "tags",
  "sales",
  "configuration",
  "activity_log",
  "emails",
  "deal_stage_history",
  "records",
  "record_notes",
  "objects",
  "fields",
  "roles",
  "views",
  "mail",
  "automation",
  "actions",
  "me",
  "search",
  "files",
  "metadata",
  "history",
]);

const NAME = /^[a-z][a-z0-9_]{1,40}$/;

export const slugOf = (label: string) =>
  label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 40);

const choice = z.object({
  value: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(100),
  color: z.string().max(30).optional(),
});

export const fieldInput = z.object({
  label: z.string().trim().min(1).max(80),
  name: z.string().optional(),
  type: z.enum(FIELD_TYPES),
  options: z
    .object({
      choices: z.array(choice).max(200).optional(),
      target: z.string().max(60).optional(),
      currency: z.string().length(3).optional(),
    })
    .default({}),
  required: z.boolean().default(false),
  position: z.number().int().min(0).max(10_000).optional(),
});

export const objectInput = z.object({
  label_singular: z.string().trim().min(1).max(60),
  label_plural: z.string().trim().min(1).max(60),
  name: z.string().optional(),
  description: z.string().max(500).default(""),
  icon: z.string().max(40).nullable().optional(),
  in_navigation: z.boolean().default(true),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A value for a custom field, checked and normalized for its type. Empty is null. */
export function fieldValue(field: FieldDefinition, raw: unknown): unknown {
  const fail = (why: string): never => {
    throw new CrmRefusal(`${field.label}: ${why}`, 400);
  };
  if (
    raw === undefined ||
    raw === null ||
    raw === "" ||
    (Array.isArray(raw) && !raw.length)
  ) {
    if (field.required) fail("this is required.");
    return null;
  }
  const text = (max: number) => {
    if (typeof raw !== "string" && typeof raw !== "number")
      fail("expected text.");
    const value = String(raw).trim();
    if (value.length > max) fail(`at most ${max} characters.`);
    return value;
  };
  const number = () => {
    const value =
      typeof raw === "number" ? raw : Number(String(raw).replace(/[, ]/g, ""));
    if (!Number.isFinite(value)) fail("expected a number.");
    return value;
  };
  const choices = new Set(
    (field.options.choices ?? []).map((each) => each.value),
  );
  switch (field.type) {
    case "text":
    case "phone":
      return text(1000);
    case "long_text":
      return text(100_000);
    case "email": {
      const value = text(254).toLowerCase();
      if (!isEmailAddress(value)) fail("expected an email address.");
      return value;
    }
    case "url": {
      const value = text(2000);
      if (!/^https?:\/\/\S+$/i.test(value))
        fail("expected a web address starting with https://.");
      return value;
    }
    case "number":
    case "currency":
      return number();
    case "rating": {
      const value = number();
      if (!Number.isInteger(value) || value < 1 || value > 5)
        fail("expected 1 to 5.");
      return value;
    }
    case "boolean":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "false") return raw === "true";
      return fail("expected yes or no.");
    case "date": {
      const value = text(10);
      if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value)))
        fail("expected a date.");
      return value;
    }
    case "datetime": {
      const value = text(40);
      if (Number.isNaN(Date.parse(value))) fail("expected a date and time.");
      return new Date(value).toISOString();
    }
    case "select": {
      const value = text(100);
      if (!choices.has(value)) fail(`"${value}" isn't one of its choices.`);
      return value;
    }
    case "multi_select": {
      const list = (Array.isArray(raw) ? raw : [raw]).map(String);
      const unknown = list.find((value) => !choices.has(value));
      if (unknown) fail(`"${unknown}" isn't one of its choices.`);
      return [...new Set(list)];
    }
    case "relation": {
      const value = number();
      if (!Number.isSafeInteger(value) || value < 1) fail("expected a record.");
      return value;
    }
  }
}

const CACHE_MS = 5_000;

/** The data model, read from crm.objects and crm.fields, and changed by admins. */
export function createMetadata(database: Database) {
  let cached: {
    at: number;
    objects: ObjectDefinition[];
    fields: FieldDefinition[];
  } | null = null;

  const load = async () => {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached;
    const [objectRows, fieldRows] = await Promise.all([
      database
        .select()
        .from(objects)
        .orderBy(asc(objects.standard), asc(objects.created_at)),
      database
        .select()
        .from(fields)
        .orderBy(asc(fields.position), asc(fields.id)),
    ]);
    cached = {
      at: Date.now(),
      objects: objectRows as ObjectDefinition[],
      fields: fieldRows.map((row) => ({
        ...row,
        options: (row.options ?? {}) as FieldOptions,
      })) as FieldDefinition[],
    };
    return cached;
  };
  const forget = () => {
    cached = null;
  };

  const objectNamed = async (name: string) => {
    const object = (await load()).objects.find((each) => each.name === name);
    if (!object) throw new CrmRefusal("Unknown object.", 404);
    return object;
  };

  const checkField = async (
    object: string,
    input: z.infer<typeof fieldInput>,
  ) => {
    if (input.type === "select" || input.type === "multi_select") {
      if (!input.options.choices?.length) {
        throw new CrmRefusal("Give the field at least one choice.", 400);
      }
    }
    if (input.type === "relation") {
      const target = input.options.target ?? "";
      if (target !== "sales") await objectNamed(target);
    }
    if (!EXTENSIBLE.has(object) && (await objectNamed(object)).standard) {
      throw new CrmRefusal("This object can't have custom fields.", 400);
    }
  };

  return {
    load,
    forget,
    objectNamed,

    async objects() {
      return (await load()).objects;
    },

    async fieldsOf(object: string, only?: "custom" | "standard") {
      return (await load()).fields.filter(
        (field) =>
          field.object === object &&
          (only === undefined || field.standard === (only === "standard")),
      );
    },

    /** Describes the standard objects, once per boot: their labels and columns may have changed. */
    async installStandard() {
      for (const standard of STANDARD) {
        const { fields: columns, ...object } = standard;
        await database
          .insert(objects)
          .values({ ...object, standard: true, description: "" })
          .onConflictDoUpdate({
            target: objects.name,
            set: {
              label_singular: object.label_singular,
              label_plural: object.label_plural,
            },
          });
        for (const [
          position,
          [name, label, type, options],
        ] of columns.entries()) {
          await database
            .insert(fields)
            .values({
              object: object.name,
              name,
              label,
              type,
              options: options ?? {},
              position,
              standard: true,
            })
            .onConflictDoUpdate({
              target: [fields.object, fields.name],
              set: { label, type, options: options ?? {}, standard: true },
            });
        }
      }
      forget();
    },

    async createObject(body: unknown) {
      const input = objectInput.parse(body);
      const name = slugOf(input.name || input.label_plural);
      if (!NAME.test(name) || RESERVED.has(name)) {
        throw new CrmRefusal(
          `"${name}" can't be an object's name. Choose another.`,
          400,
        );
      }
      const [created] = await database
        .insert(objects)
        .values({
          name,
          label_singular: input.label_singular,
          label_plural: input.label_plural,
          description: input.description,
          icon: input.icon ?? null,
          in_navigation: input.in_navigation,
        })
        .onConflictDoNothing()
        .returning();
      if (!created)
        throw new CrmRefusal(`There is already an object called ${name}.`, 400);
      // Every custom object has a title.
      await database.insert(fields).values({
        object: name,
        name: "name",
        label: "Name",
        type: "text",
        required: true,
      });
      forget();
      return created;
    },

    async updateObject(name: string, body: unknown) {
      const current = await objectNamed(name);
      const input = objectInput.partial().parse(body);
      const [updated] = await database
        .update(objects)
        .set({
          ...(input.label_singular
            ? { label_singular: input.label_singular }
            : {}),
          ...(input.label_plural ? { label_plural: input.label_plural } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.in_navigation !== undefined
            ? { in_navigation: input.in_navigation }
            : {}),
        })
        .where(eq(objects.name, current.name))
        .returning();
      forget();
      return updated;
    },

    async removeObject(name: string) {
      const object = await objectNamed(name);
      if (object.standard) throw new CrmRefusal("Standard objects stay.", 400);
      await database.delete(objects).where(eq(objects.name, name));
      forget();
    },

    async createField(object: string, body: unknown) {
      const input = fieldInput.parse(body);
      await objectNamed(object);
      await checkField(object, input);
      const name = slugOf(input.name || input.label);
      const taken = (await load()).fields.some(
        (field) => field.object === object && field.name === name,
      );
      if (!NAME.test(name) || taken) {
        throw new CrmRefusal(
          `"${name}" is taken or can't be a field's name. Choose another.`,
          400,
        );
      }
      const position =
        input.position ??
        Math.max(
          0,
          ...(await this.fieldsOf(object)).map((field) => field.position + 1),
        );
      const [created] = await database
        .insert(fields)
        .values({
          object,
          name,
          label: input.label,
          type: input.type,
          options: input.options,
          required: input.required,
          position,
        })
        .returning();
      forget();
      return created;
    },

    /** Changes a custom field. Its name and type stay: records already hold values of that type. */
    async updateField(object: string, name: string, body: unknown) {
      const current = (await this.fieldsOf(object)).find(
        (field) => field.name === name,
      );
      if (!current) throw new CrmRefusal("Unknown field.", 404);
      if (current.standard)
        throw new CrmRefusal("Standard fields can't be changed here.", 400);
      const input = fieldInput
        .omit({ type: true, name: true })
        .partial()
        .parse(body);
      if (input.options)
        await checkField(object, {
          ...current,
          ...input,
          options: input.options,
        });
      const [updated] = await database
        .update(fields)
        .set({
          ...(input.label ? { label: input.label } : {}),
          ...(input.options ? { options: input.options } : {}),
          ...(input.required !== undefined ? { required: input.required } : {}),
          ...(input.position !== undefined ? { position: input.position } : {}),
        })
        .where(and(eq(fields.object, object), eq(fields.name, name)))
        .returning();
      forget();
      return updated;
    },

    /** Removes a custom field and its values from every record. */
    async removeField(object: string, name: string) {
      const current = (await this.fieldsOf(object)).find(
        (field) => field.name === name,
      );
      if (!current) throw new CrmRefusal("Unknown field.", 404);
      if (
        current.standard ||
        (name === "name" && !STANDARD_OBJECTS.includes(object))
      ) {
        throw new CrmRefusal("This field can't be removed.", 400);
      }
      await database
        .delete(fields)
        .where(and(eq(fields.object, object), eq(fields.name, name)));
      if (EXTENSIBLE.has(object)) {
        await database.execute(
          sql`update ${sql.identifier("crm")}.${sql.identifier(object)} set custom_fields = custom_fields - ${name} where custom_fields ? ${name}`,
        );
      } else {
        await database
          .update(records)
          .set({ data: sql`${records.data} - ${name}` })
          .where(
            and(eq(records.object, object), sql`${records.data} ? ${name}`),
          );
      }
      forget();
    },
  };
}

export type Metadata = ReturnType<typeof createMetadata>;
