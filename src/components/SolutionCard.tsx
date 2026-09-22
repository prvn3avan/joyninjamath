import type { SolveResult } from "@/lib/math-solver";
import type { PhotoMathResult } from "@/lib/photo-math.types";

interface SolutionCardProps {
  result: SolveResult | PhotoMathResult | null;
  error: string | null;
  onPick: (example: string) => void;
  isThinking?: boolean;
}

const EMPTY_EXAMPLES = ["12 + 7 × 3", "3/4 + 1/2", "25% of 80", "15% off 240"];

export function SolutionCard({ result, error, onPick, isThinking = false }: SolutionCardProps) {
  if (isThinking) {
    return (
      <section aria-live="polite" className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <p className="text-sm font-medium text-muted-foreground">
          Working through the question…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-live="polite"
        className="rounded-lg border border-destructive/30 bg-card p-6"
      >
        <p className="text-sm font-medium text-destructive">{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-card/60 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Type a problem above</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Or start with one of these:
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EMPTY_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onPick(example)}
              className="rounded-full bg-secondary px-4 py-2 font-mono text-sm text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {example.replace(/\*/g, "×").replace(/\//g, "⁄")}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-live="polite" className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
      <p className="font-mono text-sm leading-relaxed text-muted-foreground">
        {result.question}
        {!/[a-z]{3,}/i.test(result.question) && <span className="mx-1">=</span>}
      </p>
      <p className="mt-2 font-mono text-5xl font-semibold tracking-tight text-solution">
        {result.answerText}
      </p>
      {result.altText && (
        <p className="mt-2 font-mono text-base text-muted-foreground">{result.altText}</p>
      )}

      {result.steps.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            How we got there
          </h2>
          <ol className="mt-4 space-y-3">
            {result.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] text-secondary-foreground"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
