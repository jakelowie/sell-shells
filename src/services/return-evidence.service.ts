import { randomUUID } from "node:crypto";
import { getSupabaseCommerceClient, getSupabaseStorageClient } from "../config/supabase";
import { ApiError } from "../errors/api-error";
import { throwDatabaseError } from "../errors/database-error";
import type { UploadedImage } from "../middleware/image-upload";

const db = () => getSupabaseCommerceClient() as any;
const bucket = "return-evidence";
const evidenceUploadStatuses = ["pending", "under_review", "additional_information_required"];

export async function uploadReturnEvidence(
  returnId: string,
  sessionId: string,
  image: UploadedImage,
) {
  const { data: request, error } = await db()
    .from("shop_return_requests")
    .select("return_id,status")
    .eq("return_id", returnId)
    .eq("session_id", sessionId)
    .maybeSingle();

  throwDatabaseError(error);
  if (!request) throw new ApiError(404, "Return request not found.");
  if (!evidenceUploadStatuses.includes(request.status)) {
    throw new ApiError(409, "Evidence can no longer be added to this return request.");
  }

  const path = `${returnId}/${randomUUID()}${image.extension}`;
  const storage = getSupabaseStorageClient().storage.from(bucket);
  const { error: uploadError } = await storage.upload(path, image.buffer, {
    contentType: image.mimeType,
    upsert: false,
  });

  if (uploadError) throw new ApiError(502, "Could not upload return evidence.");

  const { data, error: insertError } = await db()
    .from("shop_return_evidence")
    .insert({
      return_id: returnId,
      session_id: sessionId,
      object_path: path,
      mime_type: image.mimeType,
      byte_size: image.buffer.length,
    })
    .select("evidence_id,return_id,mime_type,byte_size,created_at")
    .single();

  if (insertError) {
    await storage.remove([path]);
    throwDatabaseError(insertError);
  }

  return data;
}

export async function listReturnEvidence(returnId: string, sessionId?: string) {
  let query = db()
    .from("shop_return_evidence")
    .select("evidence_id,return_id,session_id,object_path,mime_type,byte_size,created_at")
    .eq("return_id", returnId);

  if (sessionId) query = query.eq("session_id", sessionId);

  const { data, error } = await query.order("created_at", { ascending: true });
  throwDatabaseError(error);

  const storage = getSupabaseStorageClient().storage.from(bucket);
  return Promise.all(
    (data ?? []).map(async (row: any) => {
      const { data: signedUrl, error: signedUrlError } = await storage.createSignedUrl(
        row.object_path,
        600,
      );
      if (signedUrlError) throw new ApiError(502, "Could not access return evidence.");

      return { ...row, signed_url: signedUrl.signedUrl };
    }),
  );
}
