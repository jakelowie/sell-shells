import type { RequestHandler } from "express";
import { ApiError } from "../errors/api-error";

const acceptedTypes = new Map<string, { mimeType: string; extension: string }>([
  [".jpg", { mimeType: "image/jpeg", extension: ".jpg" }],
  [".jpeg", { mimeType: "image/jpeg", extension: ".jpg" }],
  [".png", { mimeType: "image/png", extension: ".png" }],
  [".webp", { mimeType: "image/webp", extension: ".webp" }],
  [".gif", { mimeType: "image/gif", extension: ".gif" }]
]);

export type UploadedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  originalName: string;
};

function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
  return false;
}

export const validateImageUpload: RequestHandler = (request, _response, next) => {
  const file = request.file;
  if (!file) {
    next(new ApiError(400, "Upload one image using the multipart field 'image'."));
    return;
  }

  const extension = requireExtension(file.originalname);
  const expected = acceptedTypes.get(extension);
  if (!expected || expected.mimeType !== file.mimetype || !hasValidImageSignature(file.buffer, file.mimetype)) {
    next(new ApiError(415, "Unsupported or invalid image. Upload a matching JPEG, PNG, WebP, or GIF file."));
    return;
  }

  request.uploadedImage = {
    buffer: file.buffer,
    mimeType: expected.mimeType,
    extension: expected.extension,
    originalName: file.originalname
  };
  next();
};

function requireExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}
