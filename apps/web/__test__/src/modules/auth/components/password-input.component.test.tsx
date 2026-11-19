/**
 * PasswordInput — password field with show / hide (spec 003, CA-05).
 *
 * Guards: the password is hidden by default; the toggle has an accessible name that says what it
 * will do, reveals the typed text, and hides it again.
 */
import { fireEvent, screen } from '@testing-library/react';

import PasswordInput from '@web/modules/auth/components/molecules/password-input.component';

import { renderWithProviders } from '@tests/test-utils/render';

describe('PasswordInput', () => {
  it('hides the password by default and toggles it with an accessible button (CA-05)', () => {
    renderWithProviders(<PasswordInput label="Contraseña" name="password" />);
    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
