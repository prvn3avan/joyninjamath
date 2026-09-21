import { z } from "zod";

import type { PhotoMathResult } from "@/lib/photo-math.types";

const PhotoResultSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  alternateForm: z.string().nullable(),
  steps: z.array(z.string().min(1)).min(1),
});

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["question", "answer", "alternateForm", "steps"],
  properties: {
    question: { type: "string" },
    answer: { type: "string" },
    alternateForm: { type: ["string", "null"] },
    steps: { type: "array", items: { type: "string" } },
  },
} as const;

function safeMessage(body: string, fallback: string) {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: { message?: unknown } };
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.error?.message === "string") return parsed.error.message;
  } catch {
    // The gateway can return plain text. Only expose short, non-HTML text.
  }
  const text = body.trim();
  return text && text.length < 300 && !text.includes("<") ? text : fallback;
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("Retry-After");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 5000);
  return 600 * 2 ** attempt + Math.floor(Math.random() * 250);
}

async function readOutputText(response: Response) {
  if (!response.body) throw new Error("The AI service returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const event = JSON.parse(data) as { type?: string; delta?: string; response?: { error?: { message?: string } } };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          output += event.delta;
        }
        if (event.type === "response.failed") {
          throw new Error(event.response?.error?.message ?? "The AI service could not analyze this photo.");
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  return output;
}

type InputContent = Array<Record<string, unknown>>;

async function solveWithGateway(
  content: InputContent,
  apiKey: string,
  unreadableMessage: string,
  failureMessage: string,
): Promise<PhotoMathResult> {
  const body = JSON.stringify({
    model: "openai/gpt-6-astra",
    stream: true,
    reasoning: { effort: "medium", summary: "auto" },
    include: ["reasoning.encrypted_content"],
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "math_solution",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentResponse = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body,
    });
    response = currentResponse;
    if (currentResponse.ok) break;
    const responseText = await currentResponse.text();
    if ((currentResponse.status === 429 || currentResponse.status >= 500) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(currentResponse, attempt)));
      continue;
    }
    throw new Error(safeMessage(responseText, "The AI service could not analyze this photo."));
  }

  if (!response?.ok) throw new Error("The AI service could not analyze this photo.");
  const output = await readOutputText(response);
  if (!output.trim()) throw new Error("No answer was found in that photo. Try a clearer picture.");

  let json: unknown;
  try {
    json = JSON.parse(output);
  } catch {
    throw new Error("The photo was read, but the answer could not be formatted. Please try again.");
  }
  const parsed = PhotoResultSchema.safeParse(json);
  if (!parsed.success) throw new Error("The photo was read, but the answer was incomplete. Please try again.");
  if (parsed.data.question === "Unreadable") {
    throw new Error("I couldn't find a clear math question. Try a brighter, closer photo.");
  }

  return {
    input: parsed.data.question,
    question: parsed.data.question,
    answerText: parsed.data.answer,
    ...(parsed.data.alternateForm ? { altText: parsed.data.alternateForm } : {}),
    steps: parsed.data.steps,
  };
}