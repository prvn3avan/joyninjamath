import { useEffect, useRef } from "react";

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function MathInput({ value, onChange, onSubmit }: MathInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  // Focus the input as soon as the page loads.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="relative">
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Try 3/4 + 1/2 or 25% of 80"
        aria-label="Math problem"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-2xl border border-border bg-card px-5 py-5 pr-12 font-mono text-xl text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring sm:text-2xl"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label="Clear input"
          className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
