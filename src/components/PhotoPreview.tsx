import { LoaderCircle, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PhotoPreviewProps {
  src: string;
  name: string;
  isAnalyzing: boolean;
  onReplace: () => void;
  onRemove: () => void;
  onSolve: () => void;
}

export function PhotoPreview({
  src,
  name,
  isAnalyzing,
  onReplace,
  onRemove,
  onSolve,
}: PhotoPreviewProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <img
          src={src}
          alt={`Selected math problem: ${name}`}
          className="h-20 w-20 shrink-0 rounded-md border border-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAnalyzing ? "Reading the problem…" : "Ready to analyze"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={onReplace} disabled={isAnalyzing} aria-label="Replace photo" title="Replace photo">
            <RefreshCw />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={isAnalyzing} aria-label="Remove photo" title="Remove photo">
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="border-t border-border p-3">
        <Button type="button" className="w-full" onClick={onSolve} disabled={isAnalyzing}>
          {isAnalyzing && <LoaderCircle className="animate-spin" />}
          {isAnalyzing ? "Analyzing picture…" : "Solve picture"}
        </Button>
      </div>
    </section>
  );
}