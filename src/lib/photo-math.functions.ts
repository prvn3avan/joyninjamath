import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { PhotoMathResponse } from "@/lib/photo-math.types";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const InputSchema = z.object({
  imageDataUrl: z.string().min(1),
});

function decodeAndValidateImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Choose a JPG, PNG, or WebP picture.");
  const mime = match[1];
  const encoded = match[2];
  if (!mime || !encoded) throw new Error("That picture could not be read.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0) throw new Error("That picture is empty.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("That picture is over 8 MB. Choose a smaller one.");

  const isJpeg = mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = mime === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = mime === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isJpeg && !isPng && !isWebp) throw new Error("That file does not appear to be a valid picture.");
}

export const solveMathPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<PhotoMathResponse> => {
    try {
      decodeAndValidateImage(data.imageDataUrl);
      const key = process.env["LOVABLE_API_KEY"];
      if (!key) return { ok: false, error: "Photo solving is not configured yet." };
      const { analyzeMathPhoto } = await import("@/lib/ai-gateway.server");
      const result = await analyzeMathPhoto(data.imageDataUrl, key);
      return { ok: true, result };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "The picture could not be analyzed.",
      };
    }
  });