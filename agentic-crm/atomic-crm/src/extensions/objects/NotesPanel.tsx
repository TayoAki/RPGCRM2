import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { crmApi, errorMessage } from "../api";

type Note = { id: number; text: string; date: string };

/** Notes on a custom object's record. */
export const NotesPanel = ({
  object,
  id,
  canAdd,
}: {
  object: string;
  id: unknown;
  canAdd: boolean;
}) => {
  const key = ["crm", "record-notes", object, String(id)];
  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: () => crmApi<Note[]>(`/notes/${object}/${id}`),
  });
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const add = async () => {
    setSaving(true);
    try {
      await crmApi(`/notes/${object}/${id}`, {
        method: "POST",
        body: { text },
      });
      setText("");
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {canAdd ? (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label="New note"
            placeholder="Add a note"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button
            size="sm"
            className="self-end"
            disabled={saving || !text.trim()}
            onClick={add}
          >
            Add note
          </Button>
        </div>
      ) : null}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="text-sm">
              <div className="text-xs text-muted-foreground">
                <RelativeDate date={note.date} />
              </div>
              <p className="whitespace-pre-line">{note.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
