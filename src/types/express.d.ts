import type { UploadedImage } from "../middleware/image-upload";

declare global {
  namespace Express {
    interface Request {
      uploadedImage?: UploadedImage;
    }
  }
}

export {};
