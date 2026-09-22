import { Camera } from "lucide-react";
import { useEffect, useRef, type ChangeEvent, type RefObject } from "react";

import { Button } from "@/components/ui/button";

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onPhotoSelect: (file: File) => void;
  photoDisabled?: boolean;
  photoInputRef?: RefObject<HTMLInputElement | null>;
}

export function MathInput({
  value,
  onChange,
  onSubmit,
  onPhotoSelect,
  photoDisabled = false,
  photoInputRef,
}: MathInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const internalFileRef = useRef<HTMLInputElement>(null);
  const fileRef = photoInputRef ?? internalFileRef;

  // Focus the input as soon as the page loads.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="flex items-stretch gap-2">
      <div className="relative min-w-0 flex-1">
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
          placeholder="Try 3/4 + 1/2, 25% of 80, or a written question"
          aria-label="Math problem"
          autoComplete="off"
          spellCheck={false}
          className="h-full w-full rounded-lg border border-border bg-card px-5 py-5 pr-12 font-mono text-xl text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring sm:text-2xl"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onChange("");
              ref.current?.focus();
            }}
            aria-label="Clear input"
            title="Clear input"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        aria-label="Choose a photo of a math problem"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (file) onPhotoSelect(file);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="h-auto w-16 shrink-0 rounded-lg"
        onClick={() => fileRef.current?.click()}
        disabled={photoDisabled}
        aria-label="Take or upload a photo of a math problem"
        title="Take or upload a photo"
      >
        <Camera className="size-5" />
      </Button>
    </div>
  );
}
