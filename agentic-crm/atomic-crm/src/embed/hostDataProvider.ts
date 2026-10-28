import {
  HttpError,
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type RaRecord,
  type ResourceCallbacks,
} from "ra-core";

import { getCompanyAvatar } from "../components/atomic-crm/providers/commons/getCompanyAvatar";
import { getContactAvatar } from "../components/atomic-crm/providers/commons/getContactAvatar";
import { searchDealCategories } from "../components/atomic-crm/providers/supabase/searchDealCategories";
import type { CrmDataProvider } from "../components/atomic-crm/providers/types";
import type { ConfigurationContextValue } from "../components/atomic-crm/root/ConfigurationContext";
import type {
  Deal,
  RAFile,
  SalesFormData,
  SearchResourceName,
  SearchResult,
} from "../components/atomic-crm/types";

type Fetch = typeof fetch;
type Json = Record<string, any>;

export const CRM_API = "/api/crm";

/**
 * Atomic CRM's data provider for the host's CRM API (/api/crm on OpenDuet's server), replacing the
 * Supabase one. The API speaks the same filter language, so the screens and their filters are
 * unchanged. Files go to the API's file store and records keep links to them.
 */
export function createHostDataProvider(
  fetchImpl: Fetch = (...args) => fetch(...args),
): CrmDataProvider {
  async function request<T = Json>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetchImpl(`${CRM_API}${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new HttpError(
        body.error ?? response.statusText,
        response.status,
        body,
      );
    }
    return body as T;
  }

  const listPath = (
    resource: string,
    { pagination, sort, filter }: Partial<GetListParams>,
  ) => {
    const query = new URLSearchParams({
      filter: JSON.stringify(filter ?? {}),
      page: String(pagination?.page ?? 1),
      perPage: String(pagination?.perPage ?? 25),
    });
    if (sort?.field) {
      query.set("sort", sort.field);
      query.set("order", sort.order);
    }
    return `/${resource}?${query}`;
  };

  const base = {
    async getList(resource: string, params: GetListParams) {
      const { data, total } = await request(listPath(resource, params));
      if (resource !== "activity_log") return { data, total };
      // The view's snake_case columns, renamed to the Activity type's fields.
      return {
        data: data.map(({ contact_note, deal_note, ...row }: Json) => ({
          ...row,
          contactNote: contact_note ?? undefined,
          dealNote: deal_note ?? undefined,
        })),
        total,
      };
    },
    async getOne(resource: string, params: { id: Identifier }) {
      return request(`/${resource}/${params.id}`);
    },
    async getMany(resource: string, params: { ids: Identifier[] }) {
      if (params.ids.length === 0) return { data: [] };
      const { data } = await request(
        listPath(resource, {
          filter: { "id@in": `(${params.ids.join(",")})` },
          pagination: { page: 1, perPage: params.ids.length },
        }),
      );
      return { data };
    },
    async getManyReference(resource: string, params: Json) {
      return request(
        listPath(resource, {
          ...params,
          filter: { ...params.filter, [params.target]: params.id },
        }),
      );
    },
    async create(resource: string, params: { data: Json }) {
      return request(`/${resource}`, { method: "POST", body: params.data });
    },
    async update(resource: string, params: { id: Identifier; data: Json }) {
      return request(`/${resource}/${params.id}`, {
        method: "PUT",
        body: params.data,
      });
    },
    async updateMany(
      resource: string,
      params: { ids: Identifier[]; data: Json },
    ) {
      return request(`/${resource}?ids=${params.ids.join(",")}`, {
        method: "PUT",
        body: params.data,
      });
    },
    async delete(resource: string, params: { id: Identifier }) {
      return request(`/${resource}/${params.id}`, { method: "DELETE" });
    },
    async deleteMany(resource: string, params: { ids: Identifier[] }) {
      return request(`/${resource}?ids=${params.ids.join(",")}`, {
        method: "DELETE",
      });
    },
  } as unknown as DataProvider;

  const crmDataProvider = {
    ...base,
    async signUp(): Promise<never> {
      throw new Error("People are added by an admin on the People screen.");
    },
    async salesCreate(): Promise<never> {
      throw new Error("Add people from the admin People screen.");
    },
    async salesUpdate(
      id: Identifier,
      data: Partial<Omit<SalesFormData, "password">>,
    ) {
      const { data: sale } = await base.update("sales", {
        id,
        data,
        previousData: { id },
      });
      return sale;
    },
    async updatePassword(): Promise<never> {
      throw new Error("Ask an admin for a new password link.");
    },
    async unarchiveDeal(deal: Deal) {
      const { data: stageDeals } = await base.getList<Deal>("deals", {
        filter: { stage: deal.stage },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "index", order: "ASC" },
      });
      return Promise.all(
        stageDeals.map((stageDeal, index) =>
          base.update("deals", {
            id: stageDeal.id,
            data: {
              index: stageDeal.id === deal.id ? 0 : index + 1,
              archived_at:
                stageDeal.id === deal.id ? null : stageDeal.archived_at,
            },
            previousData: stageDeal,
          }),
        ),
      );
    },
    async isInitialized() {
      return true;
    },
    async globalSearch(
      query: string,
      resources: readonly SearchResourceName[],
      maxResults: number,
    ): Promise<SearchResult[]> {
      const search = new URLSearchParams({
        q: query,
        resources: resources.join(","),
        max: String(maxResults),
      });
      const { data } = await request<{ data: SearchResult[] }>(
        `/search?${search}`,
      );
      return data;
    },
    async mergeContacts(sourceId: Identifier, targetId: Identifier) {
      const { data } = await request(`/contacts/${targetId}/merge`, {
        method: "POST",
        body: { duplicate_id: Number(sourceId) },
      });
      return data;
    },
    async getConfiguration(): Promise<ConfigurationContextValue> {
      const { data } = await base.getOne("configuration", { id: 1 });
      return (data?.config as ConfigurationContextValue) ?? {};
    },
    async updateConfiguration(
      config: ConfigurationContextValue,
    ): Promise<ConfigurationContextValue> {
      const { data } = await base.update("configuration", {
        id: 1,
        data: { config },
        previousData: { id: 1 },
      });
      return data.config as ConfigurationContextValue;
    },
  };

  // Files go to the CRM's file store first; the record keeps a link to them, as Atomic's did.
  const storeFile: StoreFile = async (file) => {
    if (!file?.rawFile || !(file.rawFile instanceof Blob)) return file;
    const { rawFile, ...rest } = file;
    const form = new FormData();
    form.set(
      "file",
      rawFile,
      rawFile instanceof File ? rawFile.name : (rest.title ?? "file"),
    );
    const response = await fetchImpl(`${CRM_API}/files`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new HttpError(
        body.error ?? response.statusText,
        response.status,
        body,
      );
    }
    return { ...rest, ...body.data, title: rest.title ?? body.data.title };
  };

  return withLifecycleCallbacks(
    crmDataProvider,
    lifecycleCallbacks(storeFile),
  ) as unknown as CrmDataProvider;
}

type StoreFile = <TFile extends Partial<RAFile> | undefined | null>(
  file: TFile,
) => Promise<TFile>;

// Atomic's `applyFullTextSearch`: the search box's words, against the columns that resource shows.
const searchIn = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) return params;
  const { q, ...filter } = params.filter;
  return {
    ...params,
    filter: {
      ...filter,
      "@or": Object.fromEntries(
        columns.map((column) => [
          `${column === "email" || column === "phone" ? `${column}_fts` : column}@ilike`,
          q,
        ]),
      ),
    },
  };
};

const storeAttachments = (storeFile: StoreFile) => async (data: Json) =>
  data.attachments
    ? {
        ...data,
        attachments: await Promise.all(
          data.attachments.map((file: Partial<RAFile>) => storeFile(file)),
        ),
      }
    : data;

const withContactAvatar = async <TParams extends { data: Json }>(
  params: TParams,
): Promise<TParams> => {
  const { data } = params;
  if (data.avatar?.src || !data.email_jsonb?.length) return params;
  const src = await getContactAvatar(data);
  return src ? { ...params, data: { ...data, avatar: { src } } } : params;
};

const withCompanyLogo =
  (storeFile: StoreFile) =>
  async <TParams extends { data: Json }>(params: TParams): Promise<TParams> => {
    const logo = params.data.logo?.rawFile
      ? await storeFile(params.data.logo)
      : (params.data.logo ?? (await getCompanyAvatar(params.data)));
    return { ...params, data: { ...params.data, logo } };
  };

const configLogo = async (storeFile: StoreFile, logo: unknown) =>
  typeof logo === "string"
    ? logo
    : ((await storeFile(logo as RAFile))?.src ?? "");

const lifecycleCallbacks = (storeFile: StoreFile): ResourceCallbacks[] => [
  {
    resource: "contacts",
    beforeGetList: async (params) =>
      searchIn([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params),
    beforeCreate: withContactAvatar,
    beforeUpdate: withContactAvatar,
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) =>
      searchIn(["first_name", "last_name"])(params),
  },
  {
    resource: "companies",
    beforeGetList: async (params) =>
      searchIn([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
      ])(params),
    beforeCreate: withCompanyLogo(storeFile),
    beforeUpdate: withCompanyLogo(storeFile),
  },
  {
    resource: "deals",
    beforeGetList: async (params, dataProvider) =>
      searchDealCategories(
        searchIn(["name", "description"])(params),
        params.filter?.q,
        dataProvider,
      ),
  },
  {
    resource: "sales",
    beforeGetList: async (params) =>
      searchIn(["first_name", "last_name"])(params),
    beforeSave: async (data: RaRecord) =>
      data.avatar ? { ...data, avatar: await storeFile(data.avatar) } : data,
  },
  { resource: "contact_notes", beforeSave: storeAttachments(storeFile) },
  { resource: "deal_notes", beforeSave: storeAttachments(storeFile) },
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (!config) return params;
      return {
        ...params,
        data: {
          ...params.data,
          config: {
            ...config,
            lightModeLogo: await configLogo(storeFile, config.lightModeLogo),
            darkModeLogo: await configLogo(storeFile, config.darkModeLogo),
          },
        },
      };
    },
  },
];

export type CurrentSale = {
  id: Identifier;
  first_name: string;
  last_name: string;
  avatar?: { src?: string } | null;
};

// The signed-in person's CRM user, which the server makes on their first visit.
export async function fetchCurrentSale(
  fetchImpl: Fetch = (...args) => fetch(...args),
): Promise<CurrentSale> {
  const response = await fetchImpl(`${CRM_API}/me`, {
    credentials: "same-origin",
  });
  if (!response.ok)
    throw new HttpError("Couldn't load your CRM profile.", response.status);
  return (await response.json()).data;
}
