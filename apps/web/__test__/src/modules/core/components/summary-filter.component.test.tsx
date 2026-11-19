/**
 * SummaryFilterCards and FilterBar — the project standard "summary cards as filters"
 * (spec 003, CA-07/CA-09; reused by spec 004, CA-17).
 *
 * Guards:
 * - each card shows its label and count, and its accessible name is the visible text
 *   ("Con cuenta 3", WCAG 2.5.3);
 * - pressing a card filters by it; the chosen one is pressed (aria-pressed) and pressing it again
 *   clears the filter;
 * - the line above the list announces what is shown (aria-live) and, only while filtering, offers
 *   a quiet "Ver todos" button (not a chip).
 */
import { fireEvent, screen } from '@testing-library/react';

import FilterBar from '@web/modules/core/components/filter-bar.component';
import SummaryFilterCards from '@web/modules/core/components/summary-filter-cards.component';

import { renderWithProviders } from '@tests/test-utils/render';

const options = [
  { value: 'registered', label: 'Con cuenta', count: 3, dot: 'bg-success' },
  { value: 'walk_in', label: 'Sin cuenta', count: 2, dot: 'bg-warning' },
  { value: 'disabled', label: 'Desactivados', count: 0, dot: 'bg-default-400' },
] as const;

describe('SummaryFilterCards', () => {
  it('shows each label with its count, inside a labelled group', () => {
    renderWithProviders(
      <SummaryFilterCards
        label="Filtrar por estado"
        options={[...options]}
        selected={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('group', { name: 'Filtrar por estado' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Con cuenta 3' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sin cuenta 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Desactivados 0' })).toBeVisible();
  });

  it('filters by a card when it is pressed', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <SummaryFilterCards
        label="Filtrar"
        options={[...options]}
        selected={null}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sin cuenta 2' }));

    expect(onSelect).toHaveBeenCalledWith('walk_in');
  });

  it('marks the chosen card and clears the filter when it is pressed again', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <SummaryFilterCards
        label="Filtrar"
        options={[...options]}
        selected="walk_in"
        onSelect={onSelect}
      />
    );

    const chosen = screen.getByRole('button', { name: 'Sin cuenta 2' });
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Con cuenta 3' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(chosen);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('FilterBar', () => {
  it('announces the text and offers no reset when nothing is filtered', () => {
    renderWithProviders(<FilterBar text="5 clientes" showReset={false} onReset={vi.fn()} />);

    expect(screen.getByText('5 clientes')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('button', { name: 'Ver todos' })).not.toBeInTheDocument();
  });

  it('offers "Ver todos" while filtering', () => {
    const onReset = vi.fn();
    renderWithProviders(
      <FilterBar text="2 de 5 clientes · Sin cuenta" showReset onReset={onReset} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(onReset).toHaveBeenCalled();
  });
});
