import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FIELDS } from "./ConditionsEditor";

const asText = (value: unknown) =>
  typeof value === "string"
    ? value
    : value === undefined
      ? ""
      : JSON.stringify(value);

// What was typed, kept as text unless it is clearly a number, a list or an object.
const fromText = (text: string): unknown => {
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^[[{]/.test(text.trim())) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
};

/** The fields a step sets, as field and value pairs. Values may use {{placeholders}}. */
export const ValuesEditor = ({
  value,
  onChange,
  object,
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  object?: string;
}) => {
  const entries = Object.entries(value);
  const listId = useId();
  const rename = (from: string, to: string) =>
    onChange(
      Object.fromEntries(
        entries.map(([key, item]) => [key === from ? to : key, item]),
      ),
    );

  return (
    <div className="flex flex-col gap-2">
      <datalist id={listId}>
        {(object ? (FIELDS[object] ?? []) : []).map((field) => (
          <option key={field} value={field} />
        ))}
      </datalist>
      {entries.map(([key, item]) => (
        <div key={key} className="flex gap-2 items-center">
          <Input
            list={listId}
            aria-label="Field"
            className="h-8 w-48"
            defaultValue={key}
            onBlur={(event) =>
              event.target.value &&
              event.target.value !== key &&
              rename(key, event.target.value)
            }
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            aria-label={`Value for ${key}`}
            className="h-8"
            value={asText(item)}
            onChange={(event) =>
              onChange({ ...value, [key]: fromText(event.target.value) })
            }
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Stop setting ${key}`}
            onClick={() =>
              onChange(
                Object.fromEntries(entries.filter(([other]) => other !== key)),
              )
            }
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            // Field names are letters and underscores only.
            let name = "field";
            while (name in value) name = `${name}_x`;
            onChange({ ...value, [name]: "" });
          }}
        >
          <Plus className="size-4" /> Set a field
        </Button>
      </div>
    </div>
  );
};
