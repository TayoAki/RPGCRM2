import { ArrowDown, ArrowUp } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { FieldDefinition, SavedView } from "../types";
import { FieldDisplay } from "./FieldDisplay";
import { filterKey, recordPath, titleOf, valueOf } from "./model";

export const PAGE_SIZE = 50;

type Sort = NonNullable<SavedView["config"]["sort"]>;

type TableViewProps = {
  object: string;
  custom: boolean;
  columns: FieldDefinition[];
  records: Record<string, unknown>[];
  total: number;
  page: number;
  sort: Sort | undefined;
  onPage: (page: number) => void;
  onSort: (sort: Sort) => void;
};

/** Records as rows, a column per chosen field, sortable by any of them. */
export const TableView = ({
  object,
  custom,
  columns,
  records,
  total,
  page,
  sort,
  onPage,
  onSort,
}: TableViewProps) => {
  const header = (label: string, key: string) => {
    const active = sort?.field === key;
    return (
      <button
        type="button"
        className="flex items-center gap-1 font-medium"
        onClick={() =>
          onSort({
            field: key,
            order: active && sort?.order === "ASC" ? "DESC" : "ASC",
          })
        }
      >
        {label}
        {active ? (
          sort?.order === "ASC" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : null}
      </button>
    );
  };
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, page * PAGE_SIZE);
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {custom ? header("Name", "name") : "Record"}
              </TableHead>
              {columns.map((field) => (
                <TableHead key={field.name}>
                  {header(field.label, filterKey(field, custom))}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-muted-foreground"
                >
                  No records match.
                </TableCell>
              </TableRow>
            ) : null}
            {records.map((record) => (
              <TableRow key={String(record.id)}>
                <TableCell className="font-medium">
                  <Link
                    to={recordPath(object, record.id)}
                    className="underline-offset-2 hover:underline"
                  >
                    {titleOf(object, record)}
                  </Link>
                </TableCell>
                {columns.map((field) => (
                  <TableCell key={field.name} className="max-w-64 truncate">
                    <FieldDisplay
                      field={field}
                      value={valueOf(record, field, custom)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > 0 ? (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          {first}-{last} of {total}
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={last >= total}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
};
