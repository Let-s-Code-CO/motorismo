/**
 * UserAvatar — photo or initials (spec 002, CA-30).
 *
 * Guards: with a photo URL the image is rendered (initials stay as fallback while it loads or if
 * it fails); without one, only the initials. The photo is requested without a referrer, which
 * Google photo URLs require to load reliably from another site. Decorative: the name is always
 * next to it in text.
 */
import { screen } from '@testing-library/react';

import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';

import { renderWithProviders } from '@tests/test-utils/render';

describe('UserAvatar', () => {
  it('renders the photo, without referrer, keeping the initials as fallback', () => {
    const { container } = renderWithProviders(
      <UserAvatar name="Gina Google" src="https://lh3.googleusercontent.com/a/gina" />
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/gina');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByText('GG')).toBeInTheDocument();
  });

  it('renders only the initials without a photo', () => {
    const { container } = renderWithProviders(<UserAvatar name="Óscar Operador" src={null} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('ÓO')).toBeInTheDocument();
  });

  it('is hidden from assistive technology (the name is shown as text beside it)', () => {
    renderWithProviders(<UserAvatar name="Gina Google" src={null} />);

    expect(screen.getByText('GG').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
