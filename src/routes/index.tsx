import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { HistoryList, type HistoryItem } from "@/components/HistoryList";
import { MathInput } from "@/components/MathInput";
import { PhotoPreview } from "@/components/PhotoPreview";
import { SolutionCard } from "@/components/SolutionCard";
import { TopicButtons } from "@/components/TopicButtons";
import { MathInputError, solveMath, type SolveResult } from "@/lib/math-solver";
import { solveMathPhoto } from "@/lib/photo-math.functions";
import type { PhotoMathResult } from "@/lib/photo-math.types";
import { solveWordProblem } from "@/lib/word-math.functions";

const MATH_WORDS =
  /\b(what|is|calculate|plus|minus|times|divided|by|of|off|percent|and)\b/gi;

/** Wordy input (a story problem) needs the AI solver, not the arithmetic parser. */
function isWordProblem(text: string) {
  return /[a-z]{2,}/i.test(text.replace(MATH_WORDS, " "));
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JoyNinjaMath — Solve math step by step" },
      {
        name: "description",
        content:
          "Instant answers with step-by-step working for arithmetic, fractions, decimals and percentages.",
      },
      { property: "og:title", content: "JoyNinjaMath — Solve math step by step" },
      {
        property: "og:description",
        content:
          "Instant answers with step-by-step working for arithmetic, fractions, decimals and percentages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SolveResult | PhotoMathResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [photo, setPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const analyzePhoto = useServerFn(solveMathPhoto);
  const analyzeWords = useServerFn(solveWordProblem);

  const remember = useCallback((item: HistoryItem) => {
    setHistory((items) =>
      [item, ...items.filter((existing) => existing.input !== item.input)].slice(0, 5),
    );
  }, []);

  const solveWords = useCallback(
    async (text: string) => {
      setIsThinking(true);
      setError(null);
      setResult(null);
      try {
        const response = await analyzeWords({ data: { problem: text } });
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setResult(response.result);
        remember({ input: text, answer: response.result.answerText });
      } catch {
        setError("That question could not be solved. Please try again.");
      } finally {
        setIsThinking(false);
      }
    },
    [analyzeWords, remember],
  );

  const run = useCallback(
    (text: string, allowWords = false) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setResult(null);
        setError(null);
        return;
      }
      if (isWordProblem(trimmed)) {
        if (allowWords) {
          void solveWords(trimmed);
        } else {
          setResult(null);
          setError(null);
        }
        return;
      }
      try {
        const r = solveMath(trimmed);
        setResult(r);
        setError(null);
        setHistory((h) =>
          h[0]?.input === r.input
            ? h
            : [{ input: r.input, answer: r.answerText }, ...h].slice(0, 5),
        );
      } catch (e) {
        setResult(null);
        setError(
          e instanceof MathInputError
            ? e.message
            : "Something went wrong solving that — try rephrasing it.",
        );
      }
    },
    [solveWords],
  );

  const selectPhoto = useCallback((file: File) => {
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP picture.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That picture is over 8 MB. Choose a smaller one.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("That picture could not be read.");
        return;
      }
      setInput("");
      setResult(null);
      setError(null);
      setPhoto({ name: file.name || "Math problem photo", dataUrl: reader.result });
    };
    reader.onerror = () => setError("That picture could not be read.");
    reader.readAsDataURL(file);
  }, []);

  const solvePhoto = useCallback(async () => {
    if (!photo || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const response = await analyzePhoto({ data: { imageDataUrl: photo.dataUrl } });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(response.result);
      setHistory((items) => [
        { input: response.result.input, answer: response.result.answerText },
        ...items.filter((item) => item.input !== response.result.input),
      ].slice(0, 5));
    } catch {
      setError("The picture could not be analyzed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzePhoto, isAnalyzing, photo]);

  // Solve as the user types, with a short debounce.
  useEffect(() => {
    const id = setTimeout(() => run(input), 250);
    return () => clearTimeout(id);
  }, [input, run]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-14 sm:py-20">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            JoyNinjaMath
          </h1>
          <p className="mt-2 text-muted-foreground">
            Answers with the working shown — sums, fractions, decimals and percentages.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <MathInput
            value={input}
            onChange={setInput}
            onSubmit={() => run(input)}
            onPhotoSelect={selectPhoto}
            photoDisabled={isAnalyzing}
            photoInputRef={photoInputRef}
          />
          {photo && (
            <PhotoPreview
              src={photo.dataUrl}
              name={photo.name}
              isAnalyzing={isAnalyzing}
              onReplace={() => photoInputRef.current?.click()}
              onRemove={() => {
                setPhoto(null);
                setResult(null);
                setError(null);
              }}
              onSolve={solvePhoto}
            />
          )}
          <TopicButtons onPick={setInput} />
        </div>

        <SolutionCard result={result} error={error} onPick={setInput} />

        <HistoryList items={history} onPick={setInput} />
      </main>
    </div>
  );
}
