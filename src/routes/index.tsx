import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { HistoryList, type HistoryItem } from "@/components/HistoryList";
import { MathInput } from "@/components/MathInput";
import { SolutionCard } from "@/components/SolutionCard";
import { TopicButtons } from "@/components/TopicButtons";
import { MathInputError, solveMath, type SolveResult } from "@/lib/math-solver";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StepMath — Solve math step by step" },
      {
        name: "description",
        content:
          "Instant answers with step-by-step working for arithmetic, fractions, decimals and percentages.",
      },
      { property: "og:title", content: "StepMath — Solve math step by step" },
      {
        property: "og:description",
        content:
          "Instant answers with step-by-step working for arithmetic, fractions, decimals and percentages.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const run = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setResult(null);
      setError(null);
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
  }, []);

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
            StepMath
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
          />
          <TopicButtons onPick={setInput} />
        </div>

        <SolutionCard result={result} error={error} onPick={setInput} />

        <HistoryList items={history} onPick={setInput} />
      </main>
    </div>
  );
}
