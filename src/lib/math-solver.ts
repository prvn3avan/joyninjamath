/**
 * Math solver engine.
 *
 * Parses plain-language math problems (arithmetic, fractions, decimals,
 * percentages) and produces an exact answer plus human-readable steps.
 * All arithmetic is done with exact rationals (numerator/denominator)
 * built on BigInt, so `3/4 + 1/2` yields exactly `5/4`, and very large
 * integers (up to 21+ digits) stay exact with no scientific notation.
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

type Frac = { n: bigint; d: bigint };

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1n;
}

function makeFrac(n: bigint, d: bigint = 1n): Frac {
  if (d === 0n) {
    throw new MathInputError("Dividing by zero isn't allowed — try a different number.");
  }
  if (d < 0n) {
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
  if (b.n === 0n) {
    throw new MathInputError("Dividing by zero isn't allowed — try a different number.");
  }
  return makeFrac(a.n * b.d, a.d * b.n);
};

function fmtFrac(f: Frac): string {
  return f.d === 1n ? f.n.toString() : `${f.n}/${f.d}`;
}

function reducedSuffix(res: Frac, rawN: bigint, rawD: bigint): string {
  return res.n === rawN && res.d === rawD ? "" : ` = ${fmtFrac(res)}`;
}

function mixedText(f: Frac): string | null {
  if (f.d === 1n) return null;
  const absN = f.n < 0n ? -f.n : f.n;
  if (absN < f.d) return null;
  const whole = f.n / f.d; // BigInt division truncates toward zero
  let remN = f.n % f.d;
  if (remN < 0n) remN = -remN;
  const sign = f.n < 0n ? "−" : "";
  const absWhole = whole < 0n ? -whole : whole;
  return `${sign}${absWhole} ${remN}/${f.d}`;
}

function trimZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

/** Exact decimal text when the denominator terminates, otherwise a rounded one. */
function decimalText(f: Frac): { text: string; exact: boolean } {
  if (f.d === 1n) return { text: f.n.toString(), exact: true };

  // Count the factors of 2 and 5 — a terminating decimal iff nothing else remains.
  let dd = f.d < 0n ? -f.d : f.d;
  let places = 0;
  while (dd % 2n === 0n) {
    dd /= 2n;
    places++;
  }
  while (dd % 5n === 0n) {
    dd /= 5n;
    places++;
  }
  if (dd === 1n && places <= 40) {
    const p = 10n ** BigInt(places);
    const scaled = (f.n * p) / f.d; // exact by construction
    const neg = scaled < 0n;
    const s = neg ? -scaled : scaled;
    const intPart = s / p;
    const fracPart = s % p;
    let text =
      fracPart === 0n
        ? intPart.toString()
        : `${intPart}.${fracPart.toString().padStart(places, "0")}`;
    text = trimZeros(text);
    return { text: neg ? `-${text}` : text, exact: true };
  }

  // Non-terminating: approximate with floating point for display only.
  const value = Number(f.n) / Number(f.d);
  if (!Number.isFinite(value)) {
    return { text: fmtFrac(f), exact: true };
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
      // Parse decimals exactly: 0.1 → 1/10, never the float artifact.
      const dot = raw.indexOf(".");
      let f: Frac;
      if (dot === -1) {
        f = makeFrac(BigInt(raw));
      } else {
        const places = raw.length - dot - 1;
        f = makeFrac(BigInt(raw.replace(".", "")), 10n ** BigInt(places));
      }
      tokens.push({ t: "num", f, raw });
      i += raw.length;
      if (i < expr.length && /[0-9.]/.test(expr[i]!)) {
        throw new MathInputError(
          `Two numbers are touching — add an operator between them, or check the decimal point.`,
        );
      }
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
    if (l.d > 1n && r.d > 1n) {
      const lcm = (l.d / gcd(l.d, r.d)) * r.d;
      const a = l.n * (lcm / l.d);
      const b = r.n * (lcm / r.d);
      const rawSum = op === "+" ? a + b : a - b;
      if (lcm === l.d && lcm === r.d) {
        return `${a}/${lcm} ${sym} ${b}/${lcm} = ${rawSum}/${lcm}${reducedSuffix(res, rawSum, lcm)}.`;
      }
      const lPart =
        lcm === l.d ? `${fmtFrac(l)} stays ${a}/${lcm}` : `${fmtFrac(l)} becomes ${a}/${lcm}`;
      const rPart =
        lcm === r.d ? `${fmtFrac(r)} stays ${b}/${lcm}` : `${fmtFrac(r)} becomes ${b}/${lcm}`;
      return `Use a common denominator of ${lcm}: ${lPart} and ${rPart}, then ${a}/${lcm} ${sym} ${b}/${lcm} = ${rawSum}/${lcm}${reducedSuffix(res, rawSum, lcm)}.`;
    }
    return `${fmtFrac(l)} ${sym} ${fmtFrac(r)} = ${fmtFrac(res)}.`;
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
        // Don't narrate reading a plain fraction like 3/4 — only real divisions.
        const isFractionLiteral =
          t.v === "/" && left.d === 1n && right.d === 1n && result.d !== 1n;
        if (!isFractionLiteral) {
          this.steps.push(
            `${verb}: ${fmtFrac(left)} ${sym} ${fmtFrac(right)} = ${fmtFrac(result)}`,
          );
        }
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
        const v = makeFrac(t.f.n, t.f.d * 100n);
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
  const hasFraction = /\//.test(trimmed);

  let answerText: string;
  let altText: string | undefined;
  if (result.d === 1n) {
    answerText = result.n.toString();
  } else if (hasFraction || !dec.exact) {
    // Lead with the exact fraction; show the decimal alongside.
    answerText = mixed ?? fmtFrac(result);
    altText = `= ${fmtFrac(result)}${dec.exact ? ` = ${dec.text}` : ` ≈ ${dec.text}`}`;
  } else {
    // Decimal input, terminating result: lead with the decimal.
    answerText = dec.text;
    altText = `= ${fmtFrac(result)}`;
  }

  return {
    input: trimmed,
    question: trimmed,
    answerText,
    ...(altText !== undefined ? { altText } : {}),
    steps: allSteps,
  };
}
