/**
 * RegisterDataRequestDialog — the admin registers a request from the counter or Instagram (spec
 * 017, CA-16).
 *
 * Guards: the kind, the channel and what was asked (required); the deadline it will have (an
 * inquiry, 10 business days; a correction or an erasure, 15, RN-03); registered, it is announced.
 */
import { fireEvent, screen, within } from '@testing-library/react';

import { registerDataRequest } from '@web/modules/data-rights/actions/data-rights.actions';
import RegisterDataRequestDialog from '@web/modules/data-rights/components/organisms/register-data-request-dialog.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/data-rights/actions/data-rights.actions', () => ({
  registerDataRequest: vi.fn(),
}));

const openDialog = async () => {
  renderWithProviders(<RegisterDataRequestDialog customerId="c1" />);
  fireEvent.click(screen.getByRole('button', { name: 'Registrar solicitud de datos' }));
  return screen.findByRole('dialog', { name: 'Registrar una solicitud de datos' });
};

describe('RegisterDataRequestDialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('says the deadline of each kind: 10 business days an inquiry, 15 a claim (RN-03)', async () => {
    const dialog = await openDialog();

    expect(dialog).toHaveTextContent('Plazo: 10 días hábiles.');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Supresión' }));
    expect(dialog).toHaveTextContent('Plazo: 15 días hábiles.');
  });

  it('needs what was asked (CA-16)', async () => {
    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));

    expect(await within(dialog).findByText('Escribe lo que pidió.')).toBeInTheDocument();
    expect(registerDataRequest).not.toHaveBeenCalled();
  });

  it('registers the kind, the channel and what was asked, and announces it (CA-16)', async () => {
    vi.mocked(registerDataRequest).mockResolvedValue({ ok: true });
    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Corrección' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Instagram' }));
    fireEvent.change(within(dialog).getByLabelText('Lo que pidió'), {
      target: { value: 'Su apellido está mal escrito' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));

    expect(await inToasts().findByText('Solicitud registrada.')).toBeVisible();
    expect(registerDataRequest).toHaveBeenCalledWith({
      customerId: 'c1',
      kind: 'correction',
      channel: 'instagram',
      description: 'Su apellido está mal escrito',
    });
    expect(refresh).toHaveBeenCalled();
  });
});
