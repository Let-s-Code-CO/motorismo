/**
 * PageSkeleton — the shape of a screen while its data arrive (spec 011, HU-01).
 *
 * Guards:
 * - CA-01: each kind of screen (home, list, detail, form, profile) has its own shape.
 * - CA-03: a screen reader hears once that the screen is loading («Cargando…»), not the empty
 *   shapes: one status, busy, the shapes hidden from it.
 * - CA-02: it only shows when loading takes a while: it carries the delayed appearance (300 ms;
 *   the computed delay is checked in a browser, e2e/loading.spec.ts).
 */
import { screen } from '@testing-library/react';

import PageSkeleton, {
  type PageSkeletonVariant,
} from '@web/modules/core/components/page-skeleton.component';

import { renderWithProviders } from '@tests/test-utils/render';

const VARIANTS: PageSkeletonVariant[] = ['home', 'list', 'detail', 'form', 'profile'];

describe('PageSkeleton', () => {
  it.each(VARIANTS)('draws the shape of a «%s» screen (CA-01)', (variant) => {
    const { container } = renderWithProviders(<PageSkeleton variant={variant} />);

    expect(container.querySelector(`[data-skeleton="${variant}"]`)).not.toBeNull();
    expect(container.querySelectorAll('[data-shape]').length).toBeGreaterThan(2);
  });

  it.each(VARIANTS)(
    'says «Cargando…» once and hides the shapes from screen readers (CA-03): %s',
    (variant) => {
      const { container } = renderWithProviders(<PageSkeleton variant={variant} />);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Cargando…');
      expect(status).toHaveAttribute('aria-busy', 'true');
      for (const shape of container.querySelectorAll('[data-shape]'))
        expect(shape.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  );

  it('appears only after a delay, so a fast load shows no skeleton (CA-02)', () => {
    renderWithProviders(<PageSkeleton variant="list" />);

    expect(screen.getByRole('status')).toHaveClass('animate-skeleton-in');
  });
});
