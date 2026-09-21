import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { PhotoMathResponse } from "@/lib/photo-math.types";

const InputSchema = z.object({
  problem: z.string().trim().min(3).max(2000),
});

export const solveWordProblem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<PhotoMathResponse> => {
    try {
      const key = process.env["LOVABLE_API_KEY"];
      if (!key) return { ok: false, error: "Word problem solving is not configured yet." };
      const { analyzeMathWordProblem } = await import("@/lib/ai-gateway.server");
      const result = await analyzeMathWordProblem(data.problem, key);
      return { ok: true, result };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "That question could not be solved.",
      };
    }
  });
