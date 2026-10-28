import { useGetOne } from "ra-core";
import { Star } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";

import { useConfigurationContext } from "../../components/atomic-crm/root/ConfigurationContext";
import type { FieldDefinition } from "../types";
import { recordPath, titleOf } from "./model";

const RelationLink = ({ target, id }: { target: string; id: number }) => {
  const { data } = useGetOne(target, { id }, { enabled: Number.isFinite(id) });
  if (!data) return <span>#{id}</span>;
  return target === "sales" ? (
    <span>{titleOf(target, data)}</span>
  ) : (
    <Link to={recordPath(target, id)} className="underline underline-offset-2">
      {titleOf(target, data)}
    </Link>
  );
};

const formatDate = (value: string, withTime: boolean) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(withTime ? value : `${value}T00:00:00`));

/** A field's value, read-only, as its type shows best. */
export const FieldDisplay = ({
  field,
  value,
}: {
  field: FieldDefinition;
  value: unknown;
}) => {
  const { currency } = useConfigurationContext();
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  ) {
    return <span className="text-muted-foreground">-</span>;
  }
  const choice = (option: unknown) =>
    field.options.choices?.find((each) => each.value === option)?.label ??
    String(option);
  switch (field.type) {
    case "boolean":
      return <span>{value ? "Yes" : "No"}</span>;
    case "currency":
      return (
        <span>
          {new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: field.options.currency ?? currency,
            maximumFractionDigits: 0,
          }).format(Number(value))}
        </span>
      );
    case "number":
      return <span>{new Intl.NumberFormat().format(Number(value))}</span>;
    case "date":
      return <span>{formatDate(String(value).slice(0, 10), false)}</span>;
    case "datetime":
      return <span>{formatDate(String(value), true)}</span>;
    case "select":
      return <Badge variant="secondary">{choice(value)}</Badge>;
    case "multi_select":
      return (
        <span className="flex flex-wrap gap-1">
          {(value as unknown[]).map((item) => (
            <Badge key={String(item)} variant="secondary">
              {choice(item)}
            </Badge>
          ))}
        </span>
      );
    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="underline break-all"
        >
          {String(value).replace(/^https?:\/\//, "")}
        </a>
      );
    case "email":
      return (
        <a href={`mailto:${value}`} className="underline">
          {String(value)}
        </a>
      );
    case "rating":
      return (
        <span className="flex" aria-label={`${value} out of 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`size-4 ${star <= Number(value) ? "fill-current text-amber-500" : "text-muted-foreground"}`}
            />
          ))}
        </span>
      );
    case "relation":
      return field.options.target ? (
        <RelationLink target={field.options.target} id={Number(value)} />
      ) : (
        <span>#{String(value)}</span>
      );
    case "long_text":
      return <span className="whitespace-pre-line">{String(value)}</span>;
    default:
      return <span>{String(value)}</span>;
  }
};
