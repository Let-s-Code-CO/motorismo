/**
 * BrandBand — the brand at the top of the sign-in pages on a phone or tablet (spec 009, HU-03):
 * the logo in its silver ring with sparkles, the moving shine and the business promise.
 *
 * Guards:
 * - CA-10: the band shows the logo and «Especialistas en PPF y Detailing».
 * - CA-12: the ornaments are decorative (hidden from screen readers) and the business name is
 *   announced once, as the band's name. (No animation with «reducir movimiento» is checked in a
 *   browser: e2e/ui.spec.ts.)
 */
import { screen } from '@testing-library/react';

import BrandBand from '@web/modules/core/components/brand-band.component';

import { renderWithProviders } from '@tests/test-utils/render';

describe('BrandBand', () => {
  it('shows the logo and the business promise (CA-10)', () => {
    renderWithProviders(<BrandBand />);

    expect(screen.getByRole('img', { name: 'Logo de Motorismo Detailing' })).toBeInTheDocument();
    expect(screen.getByText('Especialistas en PPF y Detailing')).toBeInTheDocument();
  });

  it('announces the business name once, as the band itself (CA-12)', () => {
    const { container } = renderWithProviders(<BrandBand />);

    expect(screen.getByRole('banner', { name: 'Motorismo Detailing' })).toBeInTheDocument();
    expect(screen.queryByText('Motorismo Detailing')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Motorismo Detailing/);
  });

  it('hides every ornament from screen readers (CA-12)', () => {
    const { container } = renderWithProviders(<BrandBand />);

    // Light, grid, shine and sparkles: everything but the logo and the promise is decorative.
    const ornaments = container.querySelectorAll('[data-ornament]');
    expect(ornaments.length).toBeGreaterThan(0);
    for (const ornament of ornaments) {
      expect(ornament.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });
});
