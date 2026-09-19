export interface HistoryItem {
  input: string;
  answer: string;
}

interface HistoryListProps {
  items: HistoryItem[];
  onPick: (problem: string) => void;
}

export function HistoryList({ items, onPick }: HistoryListProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Recent problems">
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Recent
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.input}>
            <button
              type="button"
              onClick={() => onPick(item.input)}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              {item.input} <span className="mx-0.5">→</span>{" "}
              <span className="font-semibold text-foreground">{item.answer}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
