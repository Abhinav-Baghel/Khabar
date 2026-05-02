import { Router, type IRouter } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 100 * 1024 * 1024, // allow videos up to 100MB
  },
});

function kindFor(contentType: string): "photo" | "video" | null {
  if (contentType.startsWith("image/")) return "photo";
  if (contentType.startsWith("video/")) return "video";
  return null;
}

router.post(
  "/uploads",
  requireAuth,
  upload.array("files"),
  async (req: AuthedRequest, res): Promise<void> => {
    if (!process.env.CLOUDINARY_URL) {
      res.status(500).json({ error: "CLOUDINARY_URL is not configured" });
      return;
    }

    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    // Enforce per-type limits requested by product requirements.
    for (const f of files) {
      const ct = (f.mimetype ?? "").toLowerCase();
      const kind = kindFor(ct);
      if (!kind) {
        res.status(400).json({ error: `Unsupported file type: ${f.mimetype}` });
        return;
      }
      if (kind === "photo") {
        const ok = ["image/jpeg", "image/png", "image/webp"].includes(ct);
        if (!ok) {
          res.status(400).json({ error: `Unsupported photo type: ${f.mimetype}` });
          return;
        }
        if (f.size > 10 * 1024 * 1024) {
          res.status(400).json({ error: `Photo exceeds 10MB: ${f.originalname}` });
          return;
        }
      } else {
        const ok = ["video/mp4", "video/quicktime"].includes(ct);
        if (!ok) {
          res.status(400).json({ error: `Unsupported video type: ${f.mimetype}` });
          return;
        }
        if (f.size > 100 * 1024 * 1024) {
          res.status(400).json({ error: `Video exceeds 100MB: ${f.originalname}` });
          return;
        }
      }
    }

    try {
      const uploaded = await Promise.all(
        files.map(
          (f) =>
            new Promise<{
              url: string;
              kind: "photo" | "video";
              contentType: string;
              bytes: number;
              originalName: string;
            }>((resolve, reject) => {
              const contentType = (f.mimetype ?? "application/octet-stream").toLowerCase();
              const kind = kindFor(contentType);
              if (!kind) {
                reject(new Error("Unsupported type"));
                return;
              }

              const stream = cloudinary.uploader.upload_stream(
                {
                  folder: "khabar",
                  resource_type: kind === "video" ? "video" : "image",
                  use_filename: true,
                  unique_filename: true,
                },
                (err, result) => {
                  if (err || !result?.secure_url) {
                    reject(err ?? new Error("Upload failed"));
                    return;
                  }
                  resolve({
                    url: result.secure_url,
                    kind,
                    contentType,
                    bytes: f.size,
                    originalName: f.originalname,
                  });
                },
              );
              stream.end(f.buffer);
            }),
        ),
      );

      res.status(201).json({ files: uploaded });
    } catch (error) {
      req.log.error({ err: error }, "Cloudinary upload failed");
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

export default router;

