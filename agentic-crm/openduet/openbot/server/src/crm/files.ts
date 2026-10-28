import { classifyAttachment } from "@openbot/shared/attachments";
import { eq } from "drizzle-orm";
import { sniffMimeType } from "../channels/attachment-mime";
import { contentDispositionFilename } from "../channels/attachments";
import type { Database } from "../db/client";
import { files } from "./schema";

export const MAX_CRM_FILE_BYTES = 20 * 1024 * 1024;
const FILE_PATH = "/api/crm/files/";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What a record keeps about a file: Atomic CRM's RAFile shape, pointing at this server.
export type StoredFile = {
  src: string;
  title: string;
  type: string;
  path: string;
};

export async function storeFile(
  database: Database,
  file: File,
  salesId: number,
): Promise<StoredFile> {
  const content = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(content, file.type);
  const [row] = await database
    .insert(files)
    .values({
      name: file.name || "file",
      mime_type: mimeType,
      size: content.byteLength,
      content,
      sales_id: salesId,
    })
    .returning({ id: files.id });
  if (!row) throw new Error("Could not store the file.");
  return {
    src: `${FILE_PATH}${row.id}`,
    title: file.name,
    type: mimeType,
    path: row.id,
  };
}

/**
 * A stored file, served the way OpenDuet serves chat attachments: the sniffed type, never sniffed
 * again by the browser, and only accepted image formats inline. Anything else downloads, and the
 * sandbox keeps a document from running script on this origin even if it is opened.
 */
export async function fileResponse(
  database: Database,
  id: string,
): Promise<Response | undefined> {
  if (!UUID_SHAPE.test(id)) return undefined;
  const [row] = await database
    .select({
      name: files.name,
      mime_type: files.mime_type,
      content: files.content,
    })
    .from(files)
    .where(eq(files.id, id))
    .limit(1);
  if (!row) return undefined;
  return new Response(new Uint8Array(row.content), {
    headers: {
      "Content-Type": row.mime_type,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition":
        classifyAttachment(row.mime_type) === "image"
          ? "inline"
          : `attachment; ${contentDispositionFilename(row.name)}`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
