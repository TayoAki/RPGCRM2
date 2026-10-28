-- Atomic CRM's cleanup_note_attachments: a note's files go when the note does, or when they are taken
-- off it. Files are matched by the `path` each attachment keeps (crm.files.id).
CREATE FUNCTION "crm"."note_file_ids"(attachments jsonb) RETURNS SETOF uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT (item->>'path')::uuid
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(attachments) = 'array' THEN attachments ELSE '[]'::jsonb END
  ) AS item
  WHERE item->>'path' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
$$;
--> statement-breakpoint
CREATE FUNCTION "crm"."remove_unused_note_files"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "crm"."files" WHERE id IN (
    SELECT "crm"."note_file_ids"(OLD.attachments)
    EXCEPT
    SELECT "crm"."note_file_ids"(CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.attachments END)
  );
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "contact_notes_remove_unused_files" AFTER UPDATE OR DELETE ON "crm"."contact_notes"
    FOR EACH ROW EXECUTE FUNCTION "crm"."remove_unused_note_files"();
--> statement-breakpoint
CREATE TRIGGER "deal_notes_remove_unused_files" AFTER UPDATE OR DELETE ON "crm"."deal_notes"
    FOR EACH ROW EXECUTE FUNCTION "crm"."remove_unused_note_files"();
