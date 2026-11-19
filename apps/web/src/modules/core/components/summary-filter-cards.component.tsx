type SummaryOption<T extends string> = {
  value: T;
  label: string;
  count: number;
  /** Tailwind background class of the status dot, e.g. "bg-success". */
  dot: string;
};

type SummaryFilterCardsProps<T extends string> = {
  /** Accessible name of the group, e.g. "Filtrar por estado". */
  label: string;
  options: SummaryOption<T>[];
  /** Value currently filtering the list, or null. */
  selected: T | null;
  /** Pressing a card filters by it; pressing the selected card again clears the filter. */
  onSelect: (value: T | null) => void;
};

/**
 * Project standard "summary cards as filters" (spec 003 CA-07/CA-09, reused by spec 004 CA-17):
 * how many items are in each status; each card is a toggle button that filters the list.
 */
const SummaryFilterCards = <T extends string>({
  label,
  options,
  selected,
  onSelect,
}: SummaryFilterCardsProps<T>) => (
  <div
    role="group"
    aria-label={label}
    // Four cards make a 2 × 2 grid on phones, so their labels are never cut.
    className={`grid gap-3 ${options.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}
  >
    {options.map(({ value, label: optionLabel, count, dot }) => {
      const isSelected = selected === value;
      const isDimmed = selected !== null && !isSelected;

      return (
        <button
          key={value}
          type="button"
          aria-pressed={isSelected}
          onClick={() => onSelect(isSelected ? null : value)}
          className={`min-w-0 rounded-large border bg-content1 p-3 text-left shadow-small transition-[transform,box-shadow,opacity,border-color] duration-200 outline-none hover:shadow-medium focus-visible:ring-2 focus-visible:ring-focus motion-safe:hover:-translate-y-0.5 sm:p-4 ${
            isSelected ? 'border-foreground ring-1 ring-foreground' : 'border-divider'
          } ${isDimmed ? 'opacity-55 hover:opacity-100' : ''}`}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-default-500 sm:gap-2 sm:text-xs">
            <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="truncate">{optionLabel}</span>
          </span>
          {/* The accessible name comes from the visible text ("Activos 3", WCAG 2.5.3). */}{' '}
          <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums">
            {count}
          </span>
        </button>
      );
    })}
  </div>
);

export default SummaryFilterCards;
