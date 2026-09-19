const TOPICS = [
  { label: "Addition", example: "128 + 467" },
  { label: "Subtraction", example: "1024 - 587" },
  { label: "Multiplication", example: "12 × 7" },
  { label: "Division", example: "144 ÷ 8" },
  { label: "Fractions", example: "3/4 + 1/2" },
  { label: "Decimals", example: "2.5 × 4.1" },
  { label: "Percentages", example: "25% of 80" },
  { label: "Discounts", example: "15% off 240" },
];

interface TopicButtonsProps {
  onPick: (example: string) => void;
}

export function TopicButtons({ onPick }: TopicButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Math topics">
      {TOPICS.map((topic) => (
        <button
          key={topic.label}
          type="button"
          onClick={() => onPick(topic.example)}
          title={`Try: ${topic.example}`}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {topic.label}
        </button>
      ))}
    </div>
  );
}
