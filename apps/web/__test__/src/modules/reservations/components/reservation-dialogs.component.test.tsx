/**
 * The dialogs of a reservation (spec 012, HU-04): cancelling it and giving it its own tolerance.
 *
 * Guards:
 * - CA-21: a reservation is cancelled with an optional reason (up to 200 characters); its slot gets
 *   the seat back. A refusal of the database (e.g. it is no longer pending, CA-23) is shown.
 * - CA-24 / RN-11: the admin gives a reservation its own tolerance from 0 to 60 minutes, or takes it
 *   back to the general one; out of range is said next to the field and nothing is sent.
 */
import { fireEvent, screen } from '@testing-library/react';

import {
  cancelReservation,
  setReservationTolerance,
} from '@web/modules/reservations/actions/reservations.actions';
import CancelReservationDialog from '@web/modules/reservations/components/organisms/cancel-reservation-dialog.component';
import ToleranceDialog from '@web/modules/reservations/components/organisms/tolerance-dialog.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/reservations/actions/reservations.actions', () => ({
  cancelReservation: vi.fn(),
  setReservationTolerance: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

describe('CancelReservationDialog', () => {
  const renderDialog = () => {
    const onCancelled = vi.fn();
    renderWithProviders(
      <CancelReservationDialog
        reservationId="r1"
        isOpen
        onClose={vi.fn()}
        onCancelled={onCancelled}
      />
    );
    return { onCancelled };
  };
  const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

  it('cancels with the reason typed, and says so (CA-21)', async () => {
    vi.mocked(cancelReservation).mockResolvedValue({ ok: true });
    const { onCancelled } = renderDialog();

    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), {
      target: { value: 'Se le dañó la moto' },
    });
    confirm();

    await vi.waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(cancelReservation).toHaveBeenCalledWith({ id: 'r1', reason: 'Se le dañó la moto' });
  });

  it('refuses a reason over 200 characters (201), sending nothing', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), {
      target: { value: 'a'.repeat(201) },
    });
    confirm();

    expect(screen.getByText('Máximo 200 caracteres.')).toBeInTheDocument();
    expect(cancelReservation).not.toHaveBeenCalled();
  });

  it('shows a refusal of the database (CA-23)', async () => {
    vi.mocked(cancelReservation).mockResolvedValue({ ok: false, error: 'notPending' });
    const { onCancelled } = renderDialog();

    confirm();

    expect(
      await screen.findByText('Esta reserva ya no está pendiente: no se puede cambiar.')
    ).toBeInTheDocument();
    expect(onCancelled).not.toHaveBeenCalled();
  });
});

describe('ToleranceDialog', () => {
  const renderDialog = (own: number | null = null) => {
    const onSaved = vi.fn();
    renderWithProviders(
      <ToleranceDialog
        reservationId="r1"
        own={own}
        general={15}
        isOpen
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );
    return { onSaved };
  };
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

  it('gives the reservation its own 30 minutes (CA-24)', async () => {
    vi.mocked(setReservationTolerance).mockResolvedValue({ ok: true });
    const { onSaved } = renderDialog();

    expect(screen.getByText(/La general es de 15 min/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar la general' }));
    fireEvent.change(screen.getByLabelText('Minutos (de 0 a 60)'), { target: { value: '30' } });
    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(setReservationTolerance).toHaveBeenCalledWith({ id: 'r1', minutes: 30 });
  });

  it('takes it back to the general tolerance (RN-11)', async () => {
    vi.mocked(setReservationTolerance).mockResolvedValue({ ok: true });
    renderDialog(30);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar la general' }));
    save();

    await vi.waitFor(() =>
      expect(setReservationTolerance).toHaveBeenCalledWith({ id: 'r1', minutes: null })
    );
  });

  it('refuses 61 minutes next to the field, sending nothing (RN-11)', () => {
    renderDialog(30);

    fireEvent.change(screen.getByLabelText('Minutos (de 0 a 60)'), { target: { value: '61' } });
    save();

    expect(screen.getByText('De 0 a 60 minutos.')).toBeInTheDocument();
    expect(setReservationTolerance).not.toHaveBeenCalled();
  });
});
