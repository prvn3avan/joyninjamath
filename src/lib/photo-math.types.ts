export interface PhotoMathResult {
  input: string;
  question: string;
  answerText: string;
  altText?: string;
  steps: string[];
}

export type PhotoMathResponse =
  | { ok: true; result: PhotoMathResult }
  | { ok: false; error: string };