/**
 * VoidOrderDialog — voiding an order, always with a reason (spec 008, HU-05).
 *
 * Guards:
 * - CA-21 / CA-23: the reason is required; the order is kept, marked, and stops counting (said
 *   before confirming); the confirming button is destructive.
 * - A refusal from the database (e.g. only an admin voids a closed order) is shown.
 */
import { fireEvent, screen } from '@testing-library/react';

import { voidWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import VoidOrderDialog from '@web/modules/work-orders/components/organisms/void-order-dialog.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/work-orders/actions/work-orders.actions', () => ({ voidWorkOrder: vi.fn() }));

const ORDER = '50000000-0000-4000-8000-000000000001';

const renderDialog = () => {
  const onVoided = vi.fn();
  renderWithProviders(
    <VoidOrderDialog orderId={ORDER} number={4} isOpen onCancel={vi.fn()} onVoided={onVoided} />
  );
  return { onVoided };
};

describe('VoidOrderDialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('asks for a reason before voiding, and says what voiding means (CA-21)', async () => {
    renderDialog();

    expect(
      await screen.findByText(
        'La orden se conserva, marcada como anulada, y deja de contar en el historial y los totales.'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anular orden' }));

    expect(await screen.findByText('Escribe el motivo.')).toBeInTheDocument();
    expect(voidWorkOrder).not.toHaveBeenCalled();
  });

  it('voids with the reason, with a destructive button (CA-21, CA-23)', async () => {
    vi.mocked(voidWorkOrder).mockResolvedValue({ ok: true });
    const { onVoided } = renderDialog();

    fireEvent.change(await screen.findByLabelText('Motivo'), {
      target: { value: 'El cliente se fue sin el servicio' },
    });
    const confirm = screen.getByRole('button', { name: 'Anular orden' });
    expect(confirm).toHaveClass('bg-danger-600');
    fireEvent.click(confirm);

    await vi.waitFor(() => expect(onVoided).toHaveBeenCalled());
    expect(voidWorkOrder).toHaveBeenCalledWith({
      id: ORDER,
      reason: 'El cliente se fue sin el servicio',
    });
  });

  it('shows a refusal from the database (CA-23)', async () => {
    vi.mocked(voidWorkOrder).mockResolvedValue({ ok: false, error: 'adminOnly' });
    renderDialog();

    fireEvent.change(await screen.findByLabelText('Motivo'), { target: { value: 'Error' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anular orden' }));

    expect(
      await screen.findByText('Solo un administrador puede hacer esto con una orden cerrada.')
    ).toBeInTheDocument();
  });
});
