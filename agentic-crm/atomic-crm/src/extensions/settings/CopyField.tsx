import { useNotify } from "ra-core";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyFieldProps = { label: string; value: string };

export const CopyField = ({ label, value }: CopyFieldProps) => {
  const notify = useNotify();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied.");
    } catch {
      notify("Couldn't copy. Select it and copy it.", { type: "warning" });
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1 text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copy the ${label}`}
          onClick={copy}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
};
