type SummaryOption<T extends string> = {
  value: T;
  label: string;
  count: number;
  /** Tailwind background class of the status dot, e.g. "bg-success". */
  dot: string;
  /**
   * The subsets this card adds up, e.g. "Activos" = "Con cuenta" + "Sin cuenta". The card is then
   * drawn as a panel that holds them; the whole and each part still filter on their own.
   */
  parts?: Omit<SummaryOption<T>, 'parts'>[];
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

const MOTION =
  'outline-none transition-[transform,box-shadow,opacity,border-color,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-focus';
const CHOSEN = 'border-foreground ring-1 ring-foreground';
const DIMMED = 'opacity-55 hover:opacity-100';

/** Label with its status dot, and the count below. */
const CardText = ({ label, count, dot }: { label: string; count: number; dot: string }) => (
  <>
    <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-default-500 sm:gap-2 sm:text-xs">
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{label}</span>
    </span>
    {/* The accessible name comes from the visible text ("Activos 3", WCAG 2.5.3). */}{' '}
    <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums">{count}</span>
  </>
);

/** How the whole splits into its parts, as one thin bar coloured like their dots. */
const ShareBar = <T extends string>({ parts }: { parts: Omit<SummaryOption<T>, 'parts'>[] }) => {
  const total = parts.reduce((sum, part) => sum + part.count, 0);

  return (
    <span aria-hidden className="mt-3 flex h-1 w-full gap-0.5 overflow-hidden rounded-full">
      {total === 0 ? (
        <span className="h-full w-full bg-default-200" />
      ) : (
        parts
          .filter((part) => part.count > 0)
          .map((part) => (
            <span
              key={part.value}
              className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${part.dot}`}
              style={{ width: `${(part.count / total) * 100}%` }}
            />
          ))
      )}
    </span>
  );
};

/**
 * Project standard "summary cards as filters" (spec 003 CA-07/CA-09, reused by spec 004 CA-17):
 * how many items are in each status; each card is a toggle button that filters the list. A card
 * with `parts` is shown as the sum of its subsets (spec 004 CA-17: "Activos").
 */
const SummaryFilterCards = <T extends string>({
  label,
  options,
  selected,
  onSelect,
}: SummaryFilterCardsProps<T>) => {
  const toggle = (value: T) => onSelect(selected === value ? null : value);
  const isGrouped = options.some((option) => option.parts?.length);

  const card = ({ value, label: optionLabel, count, dot }: SummaryOption<T>, grow?: number) => {
    const isSelected = selected === value;

    return (
      <button
        key={value}
        type="button"
        aria-pressed={isSelected}
        onClick={() => toggle(value)}
        style={grow ? { flexGrow: grow } : undefined}
        className={`min-w-0 rounded-large border bg-content1 p-3 text-left shadow-small hover:shadow-medium motion-safe:hover:-translate-y-0.5 sm:basis-0 sm:p-4 ${MOTION} ${
          isSelected ? CHOSEN : 'border-divider'
        } ${selected !== null && !isSelected ? DIMMED : ''}`}
      >
        <CardText label={optionLabel} count={count} dot={dot} />
      </button>
    );
  };

  const panel = (whole: SummaryOption<T>, parts: Omit<SummaryOption<T>, 'parts'>[]) => {
    const isWholeSelected = selected === whole.value;
    const isPartSelected = parts.some((part) => part.value === selected);

    return (
      <div
        key={whole.value}
        role="group"
        aria-label={whole.label}
        // The panel is as wide as the cards it holds, so every count lines up with the others.
        style={{ flexGrow: parts.length + 1 }}
        className={`flex min-w-0 flex-col gap-2 rounded-large border bg-content1 p-2 shadow-small sm:basis-0 sm:flex-row ${MOTION} ${
          isWholeSelected ? CHOSEN : 'border-divider'
        } ${selected !== null && !isWholeSelected && !isPartSelected ? DIMMED : ''}`}
      >
        <button
          type="button"
          aria-pressed={isWholeSelected}
          onClick={() => toggle(whole.value)}
          className={`flex min-w-0 flex-col rounded-medium p-2 text-left hover:bg-default-100 sm:flex-1 sm:p-2.5 ${MOTION} ${
            isPartSelected ? DIMMED : ''
          }`}
        >
          <CardText label={whole.label} count={whole.count} dot={whole.dot} />
          <ShareBar parts={parts} />
        </button>
        <div
          className="grid min-w-0 gap-2 sm:flex-[2]"
          style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}
        >
          {parts.map(({ value, label: partLabel, count, dot }) => {
            const isSelected = selected === value;
            const isDimmed = selected !== null && !isSelected && !isWholeSelected;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(value)}
                className={`min-w-0 rounded-medium border p-2.5 text-left hover:bg-content1 hover:shadow-small motion-safe:hover:-translate-y-0.5 sm:p-3 ${MOTION} ${
                  isSelected ? `bg-content1 ${CHOSEN}` : 'border-transparent bg-default-100/60'
                } ${isDimmed ? DIMMED : ''}`}
              >
                <CardText label={partLabel} count={count} dot={dot} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (isGrouped) {
    return (
      <div role="group" aria-label={label} className="flex flex-col gap-3 sm:flex-row">
        {options.map((option) =>
          option.parts?.length ? panel(option, option.parts) : card(option, 1)
        )}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      // Four cards make a 2 × 2 grid on phones, so their labels are never cut.
      className={`grid gap-3 ${options.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}
    >
      {options.map((option) => card(option))}
    </div>
  );
};

export default SummaryFilterCards;
