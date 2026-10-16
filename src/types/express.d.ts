import type { UploadedImage } from "../middleware/image-upload";

declare global {
  namespace Express {
    interface Request {
      uploadedImage?: UploadedImage;
      authUser?: { id: string; email: string | null };
      authRole?: import("../models/database").AppRole;
      shopSessionId?: string;
    }
  }
}

export {};
