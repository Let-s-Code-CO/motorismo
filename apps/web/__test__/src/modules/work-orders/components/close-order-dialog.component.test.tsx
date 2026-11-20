/**
 * CloseOrderDialog — closing an order and recording how it was paid (spec 008, HU-02).
 *
 * Guards:
 * - CA-11: the first payment comes for the whole total (one tap in the usual case); another method
 *   can be added (each new one proposes a method not used yet), and the dialog says how much is
 *   missing or left over.
 * - CA-12: a refusal from the database says what is missing.
 * - CA-13: an order of $ 0 closes without payments.
 *
 * The dialog is still fading in while the test reads it, so texts are checked for presence.
 */
import { fireEvent, screen } from '@testing-library/react';

import { closeWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import CloseOrderDialog from '@web/modules/work-orders/components/organisms/close-order-dialog.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/work-orders/actions/work-orders.actions', () => ({
  closeWorkOrder: vi.fn(),
}));

const ORDER = '50000000-0000-4000-8000-000000000001';

const renderDialog = (total = 75000) => {
  const onClosed = vi.fn();
  renderWithProviders(
    <CloseOrderDialog
      orderId={ORDER}
      number={4}
      total={total}
      isOpen
      onCancel={vi.fn()}
      onClosed={onClosed}
    />
  );
  return { onClosed };
};

describe('CloseOrderDialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('proposes the whole total in cash, so the usual case is one tap (CA-11)', async () => {
    vi.mocked(closeWorkOrder).mockResolvedValue({ ok: true });
    const { onClosed } = renderDialog();

    expect(await screen.findByLabelText('Monto')).toHaveValue('75.000');
    expect(screen.getByText('Cuadra con el total')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar orden' }));

    await vi.waitFor(() => expect(onClosed).toHaveBeenCalled());
    expect(closeWorkOrder).toHaveBeenCalledWith({
      id: ORDER,
      payments: [{ method: 'cash', amount: 75000 }],
    });
  });

  it('splits the payment between two methods, saying what is missing meanwhile (CA-11)', async () => {
    vi.mocked(closeWorkOrder).mockResolvedValue({ ok: true });
    renderDialog();

    fireEvent.change(await screen.findByLabelText('Monto'), { target: { value: '40.000' } });
    expect(screen.getByText('Falta $ 35.000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir otro medio' }));
    const amounts = screen.getAllByLabelText('Monto');
    // The new payment proposes what is missing, with a method not used yet.
    expect(amounts[1]).toHaveValue('35.000');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar orden' }));

    await vi.waitFor(() =>
      expect(closeWorkOrder).toHaveBeenCalledWith({
        id: ORDER,
        payments: [
          { method: 'cash', amount: 40000 },
          { method: 'transfer', amount: 35000 },
        ],
      })
    );
  });

  it('does not close while the payments do not add up (CA-12)', async () => {
    renderDialog();

    fireEvent.change(await screen.findByLabelText('Monto'), { target: { value: '80.000' } });
    expect(screen.getByText('Sobran $ 5.000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar orden' }));

    expect(
      await screen.findByText('Los pagos deben sumar exactamente el total.')
    ).toBeInTheDocument();
    expect(closeWorkOrder).not.toHaveBeenCalled();
  });

  it('says what is missing when the database refuses (CA-12)', async () => {
    vi.mocked(closeWorkOrder).mockResolvedValue({ ok: false, error: 'lineWithoutEmployees' });
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar orden' }));

    expect(
      await screen.findByText('Asigna empleados a todos los servicios antes de cerrar.')
    ).toBeInTheDocument();
  });

  it('closes an order of $ 0 without payments (CA-13)', async () => {
    vi.mocked(closeWorkOrder).mockResolvedValue({ ok: true });
    renderDialog(0);

    expect(await screen.findByText('Total de $ 0: no hay nada que cobrar.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar orden' }));

    await vi.waitFor(() =>
      expect(closeWorkOrder).toHaveBeenCalledWith({ id: ORDER, payments: [] })
    );
  });
});
