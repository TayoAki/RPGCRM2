import { useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { crmApi, errorMessage } from "../api";
import type { SavedView } from "../types";
import { viewsKey } from "./views";

type SaveViewDialogProps = {
  object: string;
  type: SavedView["type"];
  config: SavedView["config"];
  onSaved: (id: number) => void;
  onClose: () => void;
};

/** Keeps a list's filters, sort, columns and layout under a name, for oneself or everyone. */
export const SaveViewDialog = ({
  object,
  type,
  config,
  onSaved,
  onClose,
}: SaveViewDialogProps) => {
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const view = await crmApi<SavedView>("/views", {
        method: "POST",
        body: { object, name, type, shared, config },
      });
      await queryClient.invalidateQueries({ queryKey: viewsKey(object) });
      onSaved(view.id);
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Save as a new view</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={shared}
              onCheckedChange={(checked) => setShared(checked === true)}
            />
            Everyone on the team can use it
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
