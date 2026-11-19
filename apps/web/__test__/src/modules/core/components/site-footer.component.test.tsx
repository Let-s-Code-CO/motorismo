/**
 * SiteFooter (spec 003, CA-08): the business Instagram is always one click away, in a new tab
 * that cannot reach back into the app (rel="noopener noreferrer").
 */
import { screen } from '@testing-library/react';

import SiteFooter from '@web/modules/core/components/site-footer.component';

import { renderWithProviders } from '@tests/test-utils/render';

describe('SiteFooter', () => {
  it('links to the business Instagram in a new, isolated tab (CA-08)', () => {
    renderWithProviders(<SiteFooter />);

    const link = screen.getByRole('link', { name: /Instagram/ });
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/motorismodetail/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('@motorismodetail');
  });
});
