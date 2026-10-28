import { useQueryClient } from "@tanstack/react-query";
import { useGetList, useNotify } from "ra-core";
import {
  CalendarDays,
  Columns3,
  Kanban,
  Plus,
  Search,
  Table2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { crmApi, errorMessage } from "../api";
import type {
  FieldDefinition,
  ObjectAccess,
  ObjectDefinition,
  SavedView,
} from "../types";
import { monthFilter, startOfMonth } from "./calendar";
import { CalendarView } from "./CalendarView";
import { groupable, useFieldChoices } from "./choices";
import { FilterEditor } from "./FilterEditor";
import { type FilterRow, filterOf, rowsOf } from "./filters";
import { KanbanView } from "./KanbanView";
import { isCustomObject, searchFilter, useAccess, useObject } from "./model";
import { RecordDialog } from "./RecordDialog";
import { SaveViewDialog } from "./SaveViewDialog";
import { PAGE_SIZE, TableView } from "./TableView";
import { CREATE_PAGES, defaultColumns, useViews, viewsKey } from "./views";

const ALL = "__all__";
const BOARD_SIZE = 500;
const MONTH_SIZE = 1000;

type ViewType = SavedView["type"];
const LAYOUTS: ViewType[] = ["table", "kanban", "calendar"];

type ObjectListProps = {
  object: ObjectDefinition;
  fields: FieldDefinition[];
  access: ObjectAccess | undefined;
  view: SavedView | undefined;
  // The layout a link asked for (?layout=kanban), when no saved view says.
  layout: ViewType | undefined;
  views: SavedView[];
  onView: (id: number | null) => void;
};

const ObjectList = ({
  object,
  fields,
  access,
  view,
  layout,
  views,
  onView,
}: ObjectListProps) => {
  const custom = isCustomObject(object);
  const config = view?.config ?? {};
  const choicesOf = useFieldChoices();
  const dateFields = fields.filter(
    (field) => field.type === "date" || field.type === "datetime",
  );
  const groupFields = fields.filter(groupable);
  const [type, setType] = useState<ViewType>(view?.type ?? layout ?? "table");
  const [rows, setRows] = useState<FilterRow[]>(() =>
    rowsOf(config.filter, fields, custom),
  );
  const [sort, setSort] = useState(config.sort);
  const [columns, setColumns] = useState<string[]>(
    config.columns ?? defaultColumns(object.name, fields),
  );
  const [groupBy, setGroupBy] = useState(
    config.group_by ??
      groupFields.find((field) => choicesOf(field))?.name ??
      groupFields[0]?.name,
  );
  const [dateField, setDateField] = useState(
    config.date_field ?? dateFields[0]?.name,
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dialog, setDialog] = useState<"create" | "save" | null>(null);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const group = fields.find((field) => field.name === groupBy);
  const date = fields.find((field) => field.name === dateField);
  const shown = columns.flatMap(
    (name) => fields.find((field) => field.name === name) ?? [],
  );
  const words = searchFilter(object.name, search);
  const filter = {
    ...filterOf(rows, fields, custom),
    ...(Object.keys(words).length ? { "@and": words } : {}),
    ...(type === "calendar" && date ? monthFilter(month, date, custom) : {}),
  };
  const { data: records = [], total = 0 } = useGetList(object.name, {
    filter,
    sort,
    pagination:
      type === "table"
        ? { page, perPage: PAGE_SIZE }
        : { page: 1, perPage: type === "kanban" ? BOARD_SIZE : MONTH_SIZE },
  });

  const configOf = (): SavedView["config"] => ({
    filter: filterOf(rows, fields, custom),
    ...(sort ? { sort } : {}),
    columns,
    ...(groupBy ? { group_by: groupBy } : {}),
    ...(dateField ? { date_field: dateField } : {}),
  });
  const saveView = async () => {
    if (!view) return;
    try {
      await crmApi(`/views/${view.id}`, {
        method: "PUT",
        body: { type, config: configOf() },
      });
      await queryClient.invalidateQueries({ queryKey: viewsKey(object.name) });
      notify("View saved.");
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };
  const deleteView = async () => {
    if (!view || !window.confirm(`Delete the view "${view.name}"?`)) return;
    try {
      await crmApi(`/views/${view.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: viewsKey(object.name) });
      onView(null);
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };

  const canCreate = access?.create !== false;
  const createPage = CREATE_PAGES[object.name];
  const readOnly = new Set(access?.read_only ?? []);

  return (
    <div className="flex flex-col gap-3 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{object.label_plural}</h1>
          {object.description ? (
            <p className="text-sm text-muted-foreground">
              {object.description}
            </p>
          ) : null}
        </div>
        {canCreate && custom ? (
          <Button onClick={() => setDialog("create")}>
            <Plus className="size-4" />
            New {object.label_singular.toLowerCase()}
          </Button>
        ) : canCreate && createPage ? (
          <Button asChild>
            <Link to={createPage}>
              <Plus className="size-4" />
              New {object.label_singular.toLowerCase()}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={view ? String(view.id) : ALL}
          onValueChange={(id) => onView(id === ALL ? null : Number(id))}
        >
          <SelectTrigger aria-label="View" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All {object.label_plural}</SelectItem>
            {views.map((each) => (
              <SelectItem key={each.id} value={String(each.id)}>
                {each.name}
                {each.shared ? " (shared)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={type}
          onValueChange={(next) => next && setType(next as ViewType)}
        >
          <ToggleGroupItem value="table" aria-label="Table">
            <Table2 className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="kanban"
            aria-label="Board"
            disabled={!groupFields.length}
          >
            <Kanban className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="calendar"
            aria-label="Calendar"
            disabled={!dateFields.length}
          >
            <CalendarDays className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        {type === "kanban" ? (
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger aria-label="Group by" className="w-44">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              {groupFields.map((field) => (
                <SelectItem key={field.name} value={field.name}>
                  By {field.label.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {type === "calendar" ? (
          <Select value={dateField} onValueChange={setDateField}>
            <SelectTrigger aria-label="Date field" className="w-44">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              {dateFields.map((field) => (
                <SelectItem key={field.name} value={field.name}>
                  By {field.label.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Search"
            placeholder="Search"
            className="h-9 w-44 pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <FilterEditor
          fields={fields}
          rows={rows}
          onChange={(next) => {
            setRows(next);
            setPage(1);
          }}
        />
        {type === "table" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="size-4" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60">
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {fields.map((field) => (
                  <label
                    key={field.name}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={columns.includes(field.name)}
                      onCheckedChange={(checked) =>
                        setColumns(
                          checked
                            ? [...columns, field.name]
                            : columns.filter((name) => name !== field.name),
                        )
                      }
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        <div className="flex gap-2 sm:ml-auto">
          {view ? (
            <>
              <Button variant="outline" size="sm" onClick={saveView}>
                Save view
              </Button>
              <Button variant="ghost" size="sm" onClick={deleteView}>
                Delete view
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setDialog("save")}>
            Save as new view
          </Button>
        </div>
      </div>

      {type === "kanban" && group ? (
        <KanbanView
          object={object.name}
          custom={custom}
          groupBy={group}
          choices={choicesOf(group)}
          details={shown
            .filter((field) => field.name !== group.name)
            .slice(0, 2)}
          records={records}
          canMove={access?.update !== "none" && !readOnly.has(group.name)}
        />
      ) : type === "calendar" && date ? (
        <CalendarView
          object={object.name}
          custom={custom}
          dateField={date}
          month={month}
          records={records}
          onMonth={setMonth}
        />
      ) : (
        <TableView
          object={object.name}
          custom={custom}
          columns={shown}
          records={records}
          total={total}
          page={page}
          sort={sort}
          onPage={setPage}
          onSort={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      )}

      {dialog === "create" ? (
        <RecordDialog
          object={object}
          fields={fields.filter((field) => !readOnly.has(field.name))}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "save" ? (
        <SaveViewDialog
          object={object.name}
          type={type}
          config={configOf()}
          onSaved={(id) => {
            setDialog(null);
            onView(id);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
};

/** Any object's records as a table, a board or a calendar, with filters and saved views. */
export const ObjectListPage = () => {
  const { object: name = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { object, fields, isPending } = useObject(name);
  const { data: access } = useAccess();
  const { data: views = [], isPending: viewsPending } = useViews(name);
  const viewId = params.get("view");

  if (isPending || (viewId && viewsPending)) return null;
  if (!object) {
    return <p className="mt-4 text-muted-foreground">There's no such list.</p>;
  }
  const objectAccess = access?.objects[name];
  if (objectAccess?.read === "none") {
    return (
      <p className="mt-4 text-muted-foreground">
        Your role doesn't let you see {object.label_plural.toLowerCase()}.
      </p>
    );
  }
  const hidden = new Set(objectAccess?.hidden ?? []);
  const view = views.find((each) => String(each.id) === viewId);
  const layout = LAYOUTS.find((each) => each === params.get("layout"));
  return (
    <ObjectList
      key={`${name}:${view?.id ?? ALL}:${layout ?? ""}`}
      layout={layout}
      object={object}
      fields={fields.filter((field) => !hidden.has(field.name))}
      access={objectAccess}
      view={view}
      views={views}
      onView={(id) => setParams(id ? { view: String(id) } : {})}
    />
  );
};
