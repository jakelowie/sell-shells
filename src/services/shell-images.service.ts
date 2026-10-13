import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { getSupabaseClient, getSupabaseStorageClient } from "../config/supabase";
import { DatabaseOperationError, throwDatabaseError, type PageResult } from "../errors/database-error";
import { StorageOperationError } from "../errors/storage-error";
import type { UploadedImage } from "../middleware/image-upload";
import type { ShellImage, ShellImageListQuery, ShellImageUpdate, ShellImageWithUrl } from "../validation/shell-image";

const storageBucket = "shell_images";

function signedUrlTtlSeconds(): number {
  const configured = Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS);
  return Number.isInteger(configured) && configured >= 60 && configured <= 604800 ? configured : 3600;
}

function isValidStoragePath(path: string | null): path is string {
  return path !== null && /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(path);
}

async function addSignedUrl(record: ShellImage): Promise<ShellImageWithUrl> {
  if (!isValidStoragePath(record.storage_path)) {
    return { ...record, image_url: null, image_url_expires_at: null };
  }

  const ttl = signedUrlTtlSeconds();
  const { data, error } = await getSupabaseStorageClient().storage.from(storageBucket)
    .createSignedUrl(record.storage_path, ttl);
  if (error || !data?.signedUrl) {
    return { ...record, image_url: null, image_url_expires_at: null };
  }

  return {
    ...record,
    image_url: data.signedUrl,
    image_url_expires_at: new Date(Date.now() + ttl * 1000).toISOString()
  };
}

export async function listShellImages(query: ShellImageListQuery): Promise<PageResult<ShellImageWithUrl>> {
  let request = getSupabaseClient().from("shell_images").select("*", { count: "exact" });
  if (query.shell_id !== undefined) request = request.eq("shell_id", query.shell_id);
  if (query.file_name !== undefined) request = request.eq("file_name", query.file_name);
  if (query.is_main_image !== undefined) request = request.eq("is_main_image", query.is_main_image);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: await Promise.all((data ?? []).map(addSignedUrl)), total: count ?? 0 };
}

export async function getShellImage(id: string): Promise<ShellImageWithUrl | null> {
  const { data, error } = await getSupabaseClient().from("shell_images").select("*").eq("image_id", id).maybeSingle();
  throwDatabaseError(error);
  return data ? addSignedUrl(data) : null;
}

export async function createShellImage(input: { shell_id?: string | null; is_main_image?: boolean | null }, image: UploadedImage): Promise<ShellImageWithUrl> {
  const storagePath = `${randomUUID()}${image.extension}`;
  const storage = getSupabaseStorageClient().storage.from(storageBucket);
  const { error: uploadError } = await storage.upload(storagePath, image.buffer, {
    contentType: image.mimeType,
    upsert: false
  });
  if (uploadError) throw new StorageOperationError("upload", uploadError.message);

  try {
    const { data, error } = await getSupabaseClient().from("shell_images").insert({
      file_name: basename(image.originalName.replaceAll("\\", "/")),
      storage_path: storagePath,
      shell_id: input.shell_id ?? null,
      ...(input.is_main_image !== undefined ? { is_main_image: input.is_main_image } : {})
    }).select("*").single();
    throwDatabaseError(error);
    if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
    return addSignedUrl(data);
  } catch (error) {
    const { error: cleanupError } = await storage.remove([storagePath]);
    if (cleanupError) console.error("Could not clean up uploaded shell image after database insert failed.");
    throw error;
  }
}

export async function updateShellImage(id: string, input: ShellImageUpdate): Promise<ShellImageWithUrl | null> {
  const { data, error } = await getSupabaseClient().from("shell_images").update(input).eq("image_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data ? addSignedUrl(data) : null;
}

export async function deleteShellImage(id: string): Promise<ShellImage | null> {
  const existing = await getShellImageRecord(id);
  if (!existing) return null;

  let savedFile: Uint8Array | null = null;
  if (isValidStoragePath(existing.storage_path)) {
    const storage = getSupabaseStorageClient().storage.from(storageBucket);
    const { data: file, error: downloadError } = await storage.download(existing.storage_path);
    if (!downloadError && file) savedFile = new Uint8Array(await file.arrayBuffer());
    const { error: removeError } = await storage.remove([existing.storage_path]);
    if (removeError) throw new StorageOperationError("delete", removeError.message);

    try {
      const { data, error } = await getSupabaseClient().from("shell_images").delete().eq("image_id", id).select("*").maybeSingle();
      throwDatabaseError(error);
      if (data) return data;

      if (savedFile) {
        const { error: restoreError } = await storage.upload(existing.storage_path, savedFile, {
          contentType: contentTypeForPath(existing.storage_path), upsert: false
        });
        if (restoreError) console.error("Could not restore shell image after database delete failed.");
      }
      return null;
    } catch (error) {
      if (savedFile) {
        const { error: restoreError } = await storage.upload(existing.storage_path, savedFile, {
          contentType: contentTypeForPath(existing.storage_path), upsert: false
        });
        if (restoreError) console.error("Could not restore shell image after database delete failed.");
      }
      throw error;
    }
  }

  const { data, error } = await getSupabaseClient().from("shell_images").delete().eq("image_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}

async function getShellImageRecord(id: string): Promise<ShellImage | null> {
  const { data, error } = await getSupabaseClient().from("shell_images").select("*").eq("image_id", id).maybeSingle();
  throwDatabaseError(error);
  return data;
}

function contentTypeForPath(path: string): string {
  if (path.endsWith(".jpg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/gif";
}
