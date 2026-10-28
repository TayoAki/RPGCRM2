import type { FieldDefinition, ObjectDefinition } from "./metadata";

type Schema = Record<string, unknown>;

function schemaOf(field: FieldDefinition): Schema {
  const description = field.label;
  const choices = field.options.choices?.map((choice) => choice.value);
  switch (field.type) {
    case "number":
    case "currency":
      return { type: "number", description };
    case "rating":
      return { type: "integer", minimum: 1, maximum: 5, description };
    case "boolean":
      return { type: "boolean", description };
    case "date":
      return { type: "string", format: "date", description };
    case "datetime":
      return { type: "string", format: "date-time", description };
    case "email":
      return { type: "string", format: "email", description };
    case "url":
      return { type: "string", format: "uri", description };
    case "select":
      return {
        type: "string",
        ...(choices ? { enum: choices } : {}),
        description,
      };
    case "multi_select":
      return {
        type: "array",
        items: { type: "string", ...(choices ? { enum: choices } : {}) },
        description,
      };
    case "relation":
      return {
        type: "integer",
        description: `${description}: the id of a record in ${field.options.target}`,
      };
    default:
      return { type: "string", description };
  }
}

const ERROR = {
  description: "Refused, with the reason",
  content: {
    "application/json": {
      schema: { type: "object", properties: { error: { type: "string" } } },
    },
  },
};

const json = (schema: Schema) => ({
  content: { "application/json": { schema } },
});

const LIST_PARAMETERS = [
  {
    name: "filter",
    in: "query",
    description:
      'JSON object of filters: {"field": value} for equality, or "field@op" with op one of eq, neq, lt, lte, gt, gte, ilike, in, cs, is. Custom fields of contacts, companies, deals, meetings and proposals are "custom_fields.<name>".',
    schema: { type: "string" },
  },
  { name: "sort", in: "query", schema: { type: "string" } },
  {
    name: "order",
    in: "query",
    schema: { type: "string", enum: ["ASC", "DESC"] },
  },
  { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
  {
    name: "per_page",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 200 },
  },
];

const ID = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
};

/**
 * The public API's OpenAPI 3.1 description, from the data model as the key's owner sees it: every
 * object, standard or custom, with its fields.
 */
export function openApiDocument(
  objects: ObjectDefinition[],
  fields: FieldDefinition[],
  serverUrl: string,
  title: string,
) {
  const schemas: Record<string, Schema> = {};
  const paths: Record<string, Schema> = {};
  for (const object of objects) {
    const own = fields.filter((field) => field.object === object.name);
    const properties: Record<string, Schema> = {
      id: { type: "integer", readOnly: true },
    };
    const customProperties: Record<string, Schema> = {};
    for (const field of own) {
      const target =
        object.standard && !field.standard ? customProperties : properties;
      target[field.name] = schemaOf(field);
    }
    if (Object.keys(customProperties).length) {
      properties.custom_fields = {
        type: "object",
        properties: customProperties,
        description: "Custom fields. Sending some of them keeps the others.",
      };
    }
    const name = object.name;
    const ref = { $ref: `#/components/schemas/${name}` };
    schemas[name] = {
      type: "object",
      description: object.description || object.label_plural,
      properties,
      ...(object.standard
        ? {}
        : {
            required: own
              .filter((field) => field.required)
              .map((field) => field.name),
          }),
    };
    const tags = [object.label_plural];
    paths[`/${name}`] = {
      get: {
        tags,
        summary: `List ${object.label_plural.toLowerCase()}`,
        parameters: LIST_PARAMETERS,
        responses: {
          200: {
            description: "A page of records",
            ...json({
              type: "object",
              properties: {
                data: { type: "array", items: ref },
                total: { type: "integer" },
                page: { type: "integer" },
                per_page: { type: "integer" },
              },
            }),
          },
          400: ERROR,
          403: ERROR,
        },
      },
      post: {
        tags,
        summary: `Add a ${object.label_singular.toLowerCase()}`,
        requestBody: { required: true, ...json(ref) },
        responses: {
          201: {
            description: "Added",
            ...json({ type: "object", properties: { data: ref } }),
          },
          400: ERROR,
          403: ERROR,
        },
      },
    };
    paths[`/${name}/{id}`] = {
      parameters: [ID],
      get: {
        tags,
        summary: `Get a ${object.label_singular.toLowerCase()}`,
        responses: {
          200: {
            description: "The record",
            ...json({ type: "object", properties: { data: ref } }),
          },
          404: ERROR,
        },
      },
      patch: {
        tags,
        summary: `Change a ${object.label_singular.toLowerCase()}`,
        description: "Only the fields sent change.",
        requestBody: { required: true, ...json(ref) },
        responses: {
          200: {
            description: "Changed",
            ...json({ type: "object", properties: { data: ref } }),
          },
          400: ERROR,
          404: ERROR,
        },
      },
      delete: {
        tags,
        summary: `Delete a ${object.label_singular.toLowerCase()}`,
        responses: { 200: { description: "Deleted" }, 403: ERROR, 404: ERROR },
      },
    };
  }
  paths["/reports"] = {
    post: {
      tags: ["Reports"],
      summary: "Count, sum or average records, overall or by a field",
      requestBody: {
        required: true,
        ...json({
          type: "object",
          required: ["object"],
          properties: {
            object: { type: "string" },
            filter: { type: "object" },
            group_by: { type: "string" },
            bucket: {
              type: "string",
              enum: ["day", "week", "month", "quarter", "year"],
            },
            fn: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
            field: { type: "string" },
          },
        }),
      },
      responses: {
        200: {
          description: "One value, or one per group",
          ...json({
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: { key: {}, value: { type: "number" } },
                },
              },
            },
          }),
        },
        400: ERROR,
      },
    },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: `${title} API`,
      version: "1",
      description:
        "Read and change CRM records with an API key. A key acts as the person who made it, with their role.",
    },
    servers: [{ url: serverUrl }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description: "An API key from Settings, API keys",
        },
      },
      schemas,
    },
    paths,
  };
}
