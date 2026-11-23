/**
 * ReportsTabs — the two reports of «Reportes»: the services done (spec 015) and the payroll
 * (spec 016, RF-02).
 *
 * Guards: both are links (each report has its own address), the current one is marked
 * (`aria-current`), and they sit in a navigation named «Secciones de reportes».
 */
import { screen, within } from '@testing-library/react';

import ReportsTabs from '@web/modules/reports/components/molecules/reports-tabs.component';

import { renderWithProviders } from '@tests/test-utils/render';

const tabs = () => screen.getByRole('navigation', { name: 'Secciones de reportes' });

describe('ReportsTabs', () => {
  it('links to both reports, in order (RF-02)', () => {
    renderWithProviders(<ReportsTabs current="services" />);

    const links = within(tabs()).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Servicios', '/reports/services'],
      ['Liquidación', '/reports/payroll'],
    ]);
  });

  it.each([
    ['services', 'Servicios', 'Liquidación'],
    ['payroll', 'Liquidación', 'Servicios'],
  ] as const)('marks «%s» as the current one, and only it', (current, marked, other) => {
    renderWithProviders(<ReportsTabs current={current} />);

    expect(within(tabs()).getByRole('link', { name: marked })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(tabs()).getByRole('link', { name: other })).not.toHaveAttribute('aria-current');
  });
});
