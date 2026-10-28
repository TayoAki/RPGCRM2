-- What drizzle-kit cannot generate: the read views Atomic CRM's screens query, the triggers its
-- Supabase schema kept in the database, and the configuration singleton. Ported from
-- atomic-crm/supabase/schemas; behaviour that needed Supabase auth or the network is in the server.

ALTER TABLE "crm"."configuration" ADD CONSTRAINT "configuration_singleton" CHECK ("id" = 1);
--> statement-breakpoint
INSERT INTO "crm"."configuration" ("id", "config") VALUES (1, '{}'::jsonb) ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE VIEW "crm"."companies_summary" AS
SELECT
    c.*,
    count(DISTINCT d.id)::int AS nb_deals,
    count(DISTINCT co.id)::int AS nb_contacts
FROM "crm"."companies" c
    LEFT JOIN "crm"."deals" d ON c.id = d.company_id
    LEFT JOIN "crm"."contacts" co ON c.id = co.company_id
GROUP BY c.id;
--> statement-breakpoint
CREATE VIEW "crm"."contacts_summary" AS
SELECT
    co.*,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text AS email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text AS phone_fts,
    c.name AS company_name,
    (count(DISTINCT t.id) FILTER (WHERE t.done_date IS NULL))::int AS nb_tasks
FROM "crm"."contacts" co
    LEFT JOIN "crm"."tasks" t ON co.id = t.contact_id
    LEFT JOIN "crm"."companies" c ON co.company_id = c.id
GROUP BY co.id, c.name;
--> statement-breakpoint
CREATE VIEW "crm"."activity_log" AS
SELECT 'company.' || c.id || '.created' AS id, 'company.created' AS type, c.created_at AS date,
    c.id AS company_id, c.sales_id, to_jsonb(c.*) AS company, NULL::jsonb AS contact,
    NULL::jsonb AS deal, NULL::jsonb AS contact_note, NULL::jsonb AS deal_note
FROM "crm"."companies" c
UNION ALL
SELECT 'contact.' || co.id || '.created', 'contact.created', co.first_seen,
    co.company_id, co.sales_id, NULL, to_jsonb(co.*), NULL, NULL, NULL
FROM "crm"."contacts" co
UNION ALL
SELECT 'contactNote.' || cn.id || '.created', 'contactNote.created', cn.date,
    co.company_id, cn.sales_id, NULL, NULL, NULL, to_jsonb(cn.*), NULL
FROM "crm"."contact_notes" cn LEFT JOIN "crm"."contacts" co ON co.id = cn.contact_id
UNION ALL
SELECT 'deal.' || d.id || '.created', 'deal.created', d.created_at,
    d.company_id, d.sales_id, NULL, NULL, to_jsonb(d.*), NULL, NULL
FROM "crm"."deals" d
UNION ALL
SELECT 'dealNote.' || dn.id || '.created', 'dealNote.created', dn.date,
    d.company_id, dn.sales_id, NULL, NULL, NULL, NULL, to_jsonb(dn.*)
FROM "crm"."deal_notes" dn LEFT JOIN "crm"."deals" d ON d.id = dn.deal_id;
--> statement-breakpoint
CREATE FUNCTION "crm"."lowercase_email_jsonb"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email_jsonb IS NOT NULL THEN
    NEW.email_jsonb = COALESCE((
      SELECT jsonb_agg(jsonb_set(elem, '{email}', to_jsonb(lower(elem->>'email'))))
      FROM jsonb_array_elements(NEW.email_jsonb) AS elem
    ), '[]'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "contacts_lowercase_emails" BEFORE INSERT OR UPDATE ON "crm"."contacts"
    FOR EACH ROW EXECUTE FUNCTION "crm"."lowercase_email_jsonb"();
--> statement-breakpoint
CREATE FUNCTION "crm"."touch_contact_last_seen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "crm"."contacts" SET last_seen = NEW.date
  WHERE id = NEW.contact_id AND (last_seen IS NULL OR last_seen < NEW.date);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "contact_notes_touch_last_seen" AFTER INSERT ON "crm"."contact_notes"
    FOR EACH ROW EXECUTE FUNCTION "crm"."touch_contact_last_seen"();
--> statement-breakpoint
CREATE FUNCTION "crm"."remove_deleted_tag"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "crm"."contacts" SET tags = array_remove(tags, OLD.id) WHERE tags @> ARRAY[OLD.id];
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "tags_remove_from_contacts" AFTER DELETE ON "crm"."tags"
    FOR EACH ROW EXECUTE FUNCTION "crm"."remove_deleted_tag"();
