/* eslint-disable react-refresh/only-export-components */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const text = (value: unknown) =>
  typeof value === "string" ? value : "";

export const TextField = ({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    {multiline ? (
      <Textarea
        aria-label={label}
        rows={5}
        value={text(value)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    ) : (
      <Input
        aria-label={label}
        value={text(value)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )}
  </div>
);

export const PickOne = ({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: unknown;
  choices: { id: string; label: string }[];
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    <Select value={text(value)} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.id} value={choice.id}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
