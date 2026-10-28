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
import { Textarea } from "@/components/ui/textarea";

import { crmApi, errorMessage } from "../api";
import { metadataKey } from "../objects/model";
import type { ObjectDefinition } from "../types";

type ObjectDialogProps = {
  object?: ObjectDefinition;
  onSaved: (name: string) => void;
  onClose: () => void;
};

/** Adds a kind of record of the team's own, or renames one. */
export const ObjectDialog = ({
  object,
  onSaved,
  onClose,
}: ObjectDialogProps) => {
  const [singular, setSingular] = useState(object?.label_singular ?? "");
  const [plural, setPlural] = useState(object?.label_plural ?? "");
  const [description, setDescription] = useState(object?.description ?? "");
  const [inNavigation, setInNavigation] = useState(
    object?.in_navigation ?? true,
  );
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await crmApi<ObjectDefinition>(
        object ? `/metadata/objects/${object.name}` : "/metadata/objects",
        {
          method: object ? "PUT" : "POST",
          body: {
            label_singular: singular,
            label_plural: plural,
            description,
            in_navigation: inNavigation,
          },
        },
      );
      await queryClient.invalidateQueries({ queryKey: metadataKey });
      onSaved(saved.name);
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>{object ? "Change object" : "New object"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="object-singular">One is called</Label>
              <Input
                id="object-singular"
                required
                placeholder="Project"
                value={singular}
                onChange={(event) => setSingular(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="object-plural">Several are called</Label>
              <Input
                id="object-plural"
                required
                placeholder="Projects"
                value={plural}
                onChange={(event) => setPlural(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="object-description">Description</Label>
            <Textarea
              id="object-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={inNavigation}
              onCheckedChange={(checked) => setInNavigation(checked === true)}
            />
            Show a tab for it in the header
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !singular.trim() || !plural.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
