/**
 * Math solver engine.
 *
 * Parses plain-language math problems (arithmetic, fractions, decimals,
 * percentages) and produces an exact answer plus human-readable steps.
 * All arithmetic is done with exact rationals (numerator/denominator),
 * so `3/4 + 1/2` yields exactly `5/4`, not a rounded decimal.
 */

export class MathInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathInputError";
  }
}

export interface SolveResult {
  input: string;
  /** Normalized expression shown back to the user, e.g. "12 + 7 × 3" */
  question: string;
  /** Primary answer, e.g. "1 1/4" or "33" */
  answerText: string;
  /** Secondary form, e.g. "= 5/4 = 1.25" */
  altText?: string;
  steps: string[];
}

type Frac = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function makeFrac(n: number, d = 1): Frac {
  if (d === 0) {
    throw new MathInputError("Dividing by zero isn't allowed — try a different number.");
  }
  if (!Number.isFinite(n) || !Number.isFinite(d)) {
    throw new MathInputError("That number is too large to work with — try smaller values.");
  }
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

const addF = (a: Frac, b: Frac): Frac => makeFrac(a.n * b.d + b.n * a.d, a.d * b.d);
const subF = (a: Frac, b: Frac): Frac => makeFrac(a.n * b.d - b.n * a.d, a.d * b.d);
const mulF = (a: Frac, b: Frac): Frac => makeFrac(a.n * b.n, a.d * b.d);
const divF = (a: Frac, b: Frac): Frac => {
  if (b.n === 0) {
    throw new MathInputError("Dividing by zero isn't allowed — try a different number.");
  }
  return makeFrac(a.n * b.d, a.d * b.n);
};

function fmtFrac(f: Frac): string {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
}

function mixedText(f: Frac): string | null {
  if (f.d === 1 || Math.abs(f.n) < f.d) return null;
  const whole = Math.trunc(f.n / f.d);
  const remN = Math.abs(f.n - whole * f.d);
  const sign = f.n < 0 ? "−" : "";
  return `${sign}${Math.abs(whole)} ${remN}/${f.d}`;
}

function isTerminatingDenominator(d: number): boolean {
  let x = d;
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  return x === 1;
}

function trimZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

/** Exact decimal text when the denominator terminates, otherwise a rounded one. */
function decimalText(f: Frac): { text: string; exact: boolean } {
  const value = f.n / f.d;
  if (Number.isInteger(value)) return { text: String(value), exact: true };
  if (isTerminatingDenominator(f.d) && f.d <= 1e9 && Math.abs(f.n) <= Number.MAX_SAFE_INTEGER) {
    let dd = f.d;
    let places = 0;
    while (dd % 2 === 0) {
      dd /= 2;
      places++;
    }
    while (dd % 5 === 0) {
      dd /= 5;
      places++;
    }
    const scaled = (f.n * Math.pow(10, places)) / f.d;
    if (Number.isInteger(scaled)) {
      return { text: trimZeros((scaled / Math.pow(10, places)).toFixed(places)), exact: true };
    }
  }
  return { text: trimZeros(value.toFixed(6)), exact: false };
}

const SYMBOL: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

type Token =
  | { t: "num"; f: Frac; raw: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "pct" };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i]!;
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = expr.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
      if (!m?.[1]) {
        throw new MathInputError(
          `There's a misplaced "." in your problem — check the numbers and try again.`,
        );
      }
      const raw: string = m[1];
      const value = parseFloat(raw);
      if (!Number.isFinite(value)) {
        throw new MathInputError("That number is too large to work with — try smaller values.");
      }
      tokens.push({ t: "num", f: makeFrac(value), raw });
      i += raw.length;
      continue;
    }
    if (c === "+") {
      tokens.push({ t: "op", v: "+" });
      i++;
      continue;
    }
    if (c === "-") {
      tokens.push({ t: "op", v: "-" });
      i++;
      continue;
    }
    if (c === "*") {
      tokens.push({ t: "op", v: "*" });
      i++;
      continue;
    }
    if (c === "/") {
      tokens.push({ t: "op", v: "/" });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ t: "lp" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ t: "rp" });
      i++;
      continue;
    }
    if (c === "%") {
      tokens.push({ t: "pct" });
      i++;
      continue;
    }
    throw new MathInputError(
      `I couldn't read "${c}" in your problem — try something like 3/4 + 1/2 or 25% of 80.`,
    );
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private steps: string[],
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parseFull(): Frac {
    if (this.tokens.length === 0) {
      throw new MathInputError("Type a math problem to solve, like 3/4 + 1/2.");
    }
    const v = this.parseAdd();
    if (this.pos < this.tokens.length) {
      throw new MathInputError(
        "I got stuck partway through your problem — check for missing or extra symbols.",
      );
    }
    return v;
  }

  private parseAdd(): Frac {
    let left = this.parseMul();
    for (;;) {
      const t = this.peek();
      if (t?.t === "op" && (t.v === "+" || t.v === "-")) {
        this.next();
        const right = this.parseMul();
        const result = t.v === "+" ? addF(left, right) : subF(left, right);
        this.steps.push(this.addSubStep(t.v, left, right, result));
        left = result;
      } else {
        break;
      }
    }
    return left;
  }

  private addSubStep(op: "+" | "-", l: Frac, r: Frac, res: Frac): string {
    const sym = SYMBOL[op];
    if (l.d > 1 || r.d > 1) {
      const lcm = (l.d * r.d) / gcd(l.d, r.d);
      const a = (l.n * lcm) / l.d;
      const b = (r.n * lcm) / r.d;
      const rawSum = op === "+" ? a + b : a - b;
      const converted =
        a / lcm === l.n / l.d && r.d === lcm
          ? `${fmtFrac(l)} stays ${a}/${lcm}`
          : `${fmtFrac(l)} becomes ${a}/${lcm}`;
      const reduced = res.n === rawSum && res.d === lcm ? "" : ` = ${fmtFrac(res)}`;
      return `Use a common denominator of ${lcm}: ${converted} and ${fmtFrac(r)} becomes ${b}/${lcm}, then ${a}/${lcm} ${sym} ${b}/${lcm} = ${rawSum}/${lcm}${reduced}.`;
    }
    return `${fmtFrac(l)} ${sym} ${fmtFrac(r)} = ${fmtFrac(res)}`;
  }

  private parseMul(): Frac {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t?.t === "op" && (t.v === "*" || t.v === "/")) {
        this.next();
        const right = this.parseUnary();
        const result = t.v === "*" ? mulF(left, right) : divF(left, right);
        const verb = t.v === "*" ? "Multiply" : "Divide";
        const sym = SYMBOL[t.v];
        this.steps.push(`${verb}: ${fmtFrac(left)} ${sym} ${fmtFrac(right)} = ${fmtFrac(result)}`);
        left = result;
      } else if (t?.t === "lp") {
        // Implicit multiplication, e.g. 2(3 + 4)
        this.next();
        const right = this.parseAdd();
        this.expectRp();
        const result = mulF(left, right);
        this.steps.push(
          `Multiply: ${fmtFrac(left)} × (${fmtFrac(right)}) = ${fmtFrac(result)}`,
        );
        left = result;
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): Frac {
    const t = this.peek();
    if (t?.t === "op" && (t.v === "-" || t.v === "+")) {
      this.next();
      const v = this.parseUnary();
      return t.v === "-" ? makeFrac(-v.n, v.d) : v;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Frac {
    const t = this.next();
    if (!t) {
      throw new MathInputError("Your problem seems to be missing a number — try adding one.");
    }
    if (t.t === "num") {
      const p = this.peek();
      if (p?.t === "pct") {
        this.next();
        const v = makeFrac(t.f.n, t.f.d * 100);
        this.steps.push(`${t.raw}% means ${t.raw} ÷ 100 = ${fmtFrac(v)}.`);
        return v;
      }
      return t.f;
    }
    if (t.t === "lp") {
      const v = this.parseAdd();
      this.expectRp();
      return v;
    }
    throw new MathInputError(
      "That problem didn't quite make sense — try something like 3/4 + 1/2 or 25% of 80.",
    );
  }

  private expectRp(): void {
    const t = this.next();
    if (!t || t.t !== "rp") {
      throw new MathInputError(`You're missing a closing parenthesis ")" — add it and try again.`);
    }
  }
}

/** Normalize the raw input into a solvable expression, collecting rewrite steps. */
function preprocess(raw: string): { expr: string; steps: string[] } {
  const steps: string[] = [];
  let expr = raw
    .trim()
    .replace(/^what\s+is\s+/i, "")
    .replace(/^calculate\s+/i, "")
    .replace(/=?\s*$/, "")
    .replace(/[×✕⋅·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/\bplus\b/gi, "+")
    .replace(/\bminus\b/gi, "-")
    .replace(/\btimes\b/gi, "*")
    .replace(/\bdivided\s+by\b/gi, "/")
    .replace(/\s*percent\b/gi, "%")
    .trim();

  // "15% off 240" — a discount: you pay (100 − 15)% of 240.
  const off = expr.match(/^(.*?)(\d+(?:\.\d+)?)\s*%\s*off\s*(.+)$/i);
  if (off) {
    const prefix = off[1]!.trim();
    const pct = off[2]!;
    const rest = off[3]!.trim();
    const pay = 100 - parseFloat(pct);
    steps.push(
      `${pct}% off means you pay the remaining ${pay}% of ${rest}: ${rest} × ${pay / 100}.`,
    );
    expr = `${prefix} ${rest} * (1 - ${pct} / 100)`.trim();
  }

  // "of" means multiply: 25% of 80, or 3/4 of 12.
  expr = expr.replace(/\bof\b/gi, "*");

  // Mixed numbers: 2 1/4 → 2 + 1/4
  expr = expr.replace(/\b(\d+)\s+(\d+)\s*\/\s*(\d+)\b/g, "($1 + $2 / $3)");

  return { expr, steps };
}

/** Display form of the normalized expression with math symbols restored. */
function displayExpr(expr: string): string {
  return expr
    .replace(/\*/g, " × ")
    .replace(/\//g, " ÷ ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Solve a math problem given in plain language.
 * Throws MathInputError with a friendly message for anything it can't read.
 */
export function solveMath(input: string): SolveResult {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new MathInputError("Type a math problem to solve, like 3/4 + 1/2.");
  }

  const { expr, steps: preSteps } = preprocess(trimmed);
  if (!expr) {
    throw new MathInputError("Type a math problem to solve, like 3/4 + 1/2.");
  }

  const tokens = tokenize(expr);
  const steps: string[] = [];
  const parser = new Parser(tokens, steps);
  const result = parser.parseFull();

  const allSteps = [...preSteps, ...steps];
  const dec = decimalText(result);
  const mixed = mixedText(result);

  let answerText: string;
  let altText: string | undefined;
  if (result.d === 1) {
    answerText = String(result.n);
  } else if (mixed) {
    answerText = mixed;
    const fracPart = `${fmtFrac(result)}${dec.exact ? ` = ${dec.text}` : ` ≈ ${dec.text}`}`;
    altText = `= ${fracPart}`;
  } else {
    answerText = fmtFrac(result);
    altText = dec.exact ? `= ${dec.text}` : `≈ ${dec.text}`;
  }

  return {
    input: trimmed,
    question: displayExpr(expr),
    answerText,
    altText,
    steps: allSteps,
  };
}
