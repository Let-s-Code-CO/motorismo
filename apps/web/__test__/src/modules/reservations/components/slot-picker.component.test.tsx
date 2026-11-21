/**
 * SlotPicker — the slots of the chosen day in «Nueva reserva» (spec 012, HU-01).
 *
 * Guards:
 * - CA-03: every slot of the day, in order, with its free seats («1 de 2 libres»); full ones and
 *   ones that have started are shown but cannot be chosen; a closed day says «Cerrado» and a week
 *   not enabled says «Semana sin habilitar», with no slots.
 * - CA-20: a reservation being changed counts its own seat as free in its own slot.
 */
import { fireEvent, screen } from '@testing-library/react';

import SlotPicker from '@web/modules/reservations/components/molecules/slot-picker.component';
import type { AgendaSlot } from '@web/modules/reservations/types/reservations.types';

import { renderWithProviders } from '@tests/test-utils/render';

/** A one-hour slot of 12 June 2030 in Bogotá, starting at `hour`. */
const slot = (hour: number, overrides: Partial<AgendaSlot> = {}): AgendaSlot => ({
  slot_start: `2030-06-12T${String(hour).padStart(2, '0')}:00:00-05:00`,
  slot_end: `2030-06-12T${String(hour + 1).padStart(2, '0')}:00:00-05:00`,
  seats: 2,
  taken: 0,
  started: false,
  ...overrides,
});

const renderPicker = (props: Partial<Parameters<typeof SlotPicker>[0]> = {}) => {
  const onChange = vi.fn();
  renderWithProviders(
    <SlotPicker
      state="open"
      slots={[]}
      value={null}
      onChange={onChange}
      label="Franja"
      {...props}
    />
  );
  return { onChange };
};

describe('SlotPicker', () => {
  it('lists the slots in order with their free seats, and hands over the chosen one (CA-03)', () => {
    const { onChange } = renderPicker({ slots: [slot(9, { taken: 1 }), slot(10)] });

    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      '9:00 a. m. – 10:00 a. m.1 de 2 libres',
      '10:00 a. m. – 11:00 a. m.2 de 2 libres',
    ]);
    fireEvent.click(screen.getByRole('radio', { name: /9:00 a\. m\. – 10:00/ }));
    expect(onChange).toHaveBeenCalledWith('2030-06-12T09:00:00-05:00');
  });

  it('shows a full slot and one that has started, but neither can be chosen (CA-03)', () => {
    renderPicker({ slots: [slot(9, { started: true }), slot(10, { taken: 2 }), slot(11)] });

    expect(screen.getByRole('radio', { name: /^9:00 a\. m\./ })).toBeDisabled();
    expect(screen.getByText('Ya empezó')).toBeVisible();
    expect(screen.getByRole('radio', { name: /10:00 a\. m\. – 11/ })).toBeDisabled();
    expect(screen.getByText('Llena')).toBeVisible();
    expect(screen.getByRole('radio', { name: /^11:00 a\. m\./ })).toBeEnabled();
  });

  it('counts its own seat as free when a reservation is changed (CA-20)', () => {
    // 2 seats, both taken, one by this reservation: 2 − 2 + 1 = 1 free for it.
    renderPicker({ slots: [slot(9, { taken: 2 })], ownSlot: '2030-06-12T09:00:00-05:00' });

    expect(screen.getByRole('radio', { name: /^9:00 a\. m\./ })).toBeEnabled();
    expect(screen.getByText('1 de 2 libres')).toBeVisible();
  });

  it('says «Cerrado» on a closed day, with no slots (CA-03)', () => {
    renderPicker({ state: 'closed' });

    expect(screen.getByRole('status')).toHaveTextContent('Cerrado');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('says «Semana sin habilitar» on a week not enabled, with no slots (CA-03)', () => {
    renderPicker({ state: 'unenabled' });

    expect(screen.getByRole('status')).toHaveTextContent('Semana sin habilitar');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
