/**
 * ToastRegion — the floating notices of what the person just did (spec 013), mounted once in the
 * root layout so they survive client navigations.
 *
 * Guards:
 * - CA-10: a region «Avisos»; confirmations go in a polite live region, errors in an assertive
 *   one; showing a notice never moves the focus.
 * - CA-03 / RN-01: a confirmation closes by itself after 5 s; while the pointer or the keyboard
 *   focus is on it, it waits, and then closes with the time it had left.
 * - CA-04 / CA-11: «Cerrar» closes it at once; it is reachable with Tab and has a name.
 * - CA-07 / RN-01: an error never closes by itself.
 * - CA-06: up to 3, the newest last (nearest the bottom edge).
 * - CA-05: a notice for another screen shows when that screen is reached.
 * Position (CA-02) and motion (CA-12) are checked in a browser (`e2e/toasts.spec.ts`).
 */
import { usePathname } from 'next/navigation';

import { act, fireEvent, screen, within } from '@testing-library/react';

import ToastRegion from '@web/modules/core/components/toast-region.component';
import { notify, resetToasts } from '@web/modules/core/lib/toast.lib';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/agenda/schedule') }));

const region = () => screen.getByRole('region', { name: 'Avisos' });
const live = (politeness: 'polite' | 'assertive') =>
  region().querySelector<HTMLElement>(`[aria-live="${politeness}"]`)!;
const confirmations = () => live('polite');
const errors = () => live('assertive');
const say = (text: string, tone: 'success' | 'danger' = 'success') =>
  act(() => notify({ tone, text }));

describe('ToastRegion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    act(resetToasts);
    vi.useRealTimers();
  });

  it('puts a confirmation in the polite live region and an error in the immediate one (CA-10)', () => {
    renderWithProviders(
      <>
        <button type="button">Guardar configuración</button>
        <ToastRegion />
      </>,
      { toasts: false }
    );
    const button = screen.getByRole('button', { name: 'Guardar configuración' });
    button.focus();

    say('Configuración guardada.');
    say('No se pudo guardar. Inténtalo de nuevo.', 'danger');

    expect(within(confirmations()).getByText('Configuración guardada.')).toBeVisible();
    expect(within(errors()).getByText('No se pudo guardar. Inténtalo de nuevo.')).toBeVisible();
    // Only the new notice is read, not the whole list again.
    expect(confirmations()).toHaveAttribute('aria-atomic', 'false');
    expect(errors()).toHaveAttribute('aria-atomic', 'false');
    expect(button).toHaveFocus();
  });

  it('closes a confirmation after 5 seconds, not before (CA-03)', () => {
    renderWithProviders(<ToastRegion />, { toasts: false });
    say('Configuración guardada.');

    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByText('Configuración guardada.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Configuración guardada.')).not.toBeInTheDocument();
  });

  it('waits while the pointer is on it, then closes with the time it had left (CA-03)', () => {
    renderWithProviders(<ToastRegion />, { toasts: false });
    say('Configuración guardada.');
    const toast = screen.getByText('Configuración guardada.').closest('[data-toast]')!;

    act(() => vi.advanceTimersByTime(3000));
    fireEvent.pointerEnter(toast);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Configuración guardada.')).toBeInTheDocument();

    fireEvent.pointerLeave(toast);
    // 5000 − 3000 = 2000 left.
    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByText('Configuración guardada.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Configuración guardada.')).not.toBeInTheDocument();
  });

  it('waits while the keyboard focus is on it, then closes with the time it had left (CA-03)', () => {
    renderWithProviders(<ToastRegion />, { toasts: false });
    say('Configuración guardada.');
    const close = screen.getByRole('button', { name: 'Cerrar' });

    act(() => vi.advanceTimersByTime(1000));
    act(() => close.focus());
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Configuración guardada.')).toBeInTheDocument();

    act(() => close.blur());
    // 5000 − 1000 = 4000 left.
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByText('Configuración guardada.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Configuración guardada.')).not.toBeInTheDocument();
  });

  it('closes at once with «Cerrar», a named button reachable with Tab (CA-04, CA-11)', () => {
    renderWithProviders(<ToastRegion />, { toasts: false });
    say('Configuración guardada.');

    const close = screen.getByRole('button', { name: 'Cerrar' });
    expect(close).not.toHaveAttribute('tabindex', '-1');
    fireEvent.click(close);

    expect(screen.queryByText('Configuración guardada.')).not.toBeInTheDocument();
  });

  it('keeps an error until the person closes it (CA-07)', () => {
    renderWithProviders(<ToastRegion />, { toasts: false });
    say('No se pudo desactivar.', 'danger');

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('No se pudo desactivar.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('No se pudo desactivar.')).not.toBeInTheDocument();
  });

  it('shows up to 3, the newest last, nearest the bottom edge (CA-06)', () => {
    renderWithProviders(<ToastRegion />, { toasts: false });
    for (const text of ['Uno.', 'Dos.', 'Tres.', 'Cuatro.']) say(text);

    expect(
      within(confirmations())
        .getAllByText(/\.$/)
        .map((item) => item.textContent)
    ).toEqual(['Dos.', 'Tres.', 'Cuatro.']);
  });

  it('shows a notice left for another screen once that screen is reached (CA-05)', () => {
    const { rerender } = renderWithProviders(<ToastRegion />, { toasts: false });
    act(() => notify({ tone: 'success', text: 'Reserva guardada.', after: '/agenda/r1' }));
    expect(screen.queryByText('Reserva guardada.')).not.toBeInTheDocument();

    vi.mocked(usePathname).mockReturnValue('/agenda/r1');
    rerender(<ToastRegion />);

    expect(screen.getByText('Reserva guardada.')).toBeVisible();
  });
});
