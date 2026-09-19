# Math Solver App

A single-page web app that solves everyday math problems — addition, subtraction, multiplication, division, fractions, decimals, and percentages — with clear step-by-step working shown for every answer.

## What it does

- **Smart input box** at the center: type any problem naturally, e.g.
  - `12 + 7 × 3`
  - `3/4 + 1/2`
  - `25% of 80`
  - `15% off 240`
  - `2.5 × 4.1`
  - `(8 - 3) ÷ 1.5`
- **Quick topic buttons** below the input (Addition, Subtraction, Multiplication, Division, Fractions, Decimals, Percentages). Clicking one focuses the input and shows a small example hint for that topic.
- **Step-by-step solution**: below the answer, a numbered list shows how the result was reached (order of operations applied, fraction common denominators, percentage conversion), written in plain language.
- **Instant solving** as the user types (debounced), plus pressing Enter.
- **Recent history** of the last few solved problems on the page (session only, no login, no database).

## Pages

- `src/routes/index.tsx` — the whole app on the home page, with its own `head()` metadata (title, description, og tags). No other routes needed.

## How it works (technical)

- Pure frontend, client-side math — no backend, database, or auth required.
- A small math engine in `src/lib/math-solver.ts`:
  1. **Tokenizer + parser**: converts the input string into tokens (numbers, operators, parentheses, fractions written as `a/b`, `%`).
  2. **Percentage handling**: recognizes patterns like `X% of Y`, `X% off Y`, `X% + Y`, `X% − Y` and rewrites them into arithmetic (e.g. `25% of 80` → `80 × 0.25`) before solving; notes the rewrite as a solution step.
  3. **Evaluator**: recursive-descent parser honoring order of operations (parentheses → × ÷ → + −).
  4. **Exact fraction arithmetic**: fractions are computed as exact rationals internally (numerator/denominator), so `3/4 + 1/2` returns exactly `1 1/4` / `5/4` instead of a rounded decimal; results are presented as a mixed number plus decimal form when both are meaningful.
  5. **Step recorder**: each rewrite/operation appends a human-readable step string used by the UI.
- Friendly error messages for invalid input ("Hmm, I couldn't read that — try something like 3/4 + 1/2") shown inline, never a crash.
- Components in `src/components/`: `MathInput`, `TopicButtons`, `SolutionCard` (answer + steps), `HistoryList`.

## Design

- Clean, neutral look suitable for anyone: warm off-white background, deep ink text, one confident accent color for the answer, generous spacing, large legible numerals.
- Distinctive typography: a strong geometric sans for headings and a mono-style numeral treatment for the answer so results feel like a "solution card".
- Fully responsive; works on phone and desktop.
- All colors via the existing semantic tokens in `src/styles.css` (updated `:root` values), no hardcoded hex in components.

## Verification

- Unit-style checks on the math engine for representative inputs (order of operations, fractions, percentages, decimals, errors) run via `bunx vitest run`.
- Playwright pass on the preview: type several problems, confirm answers and steps render, screenshot the result.
