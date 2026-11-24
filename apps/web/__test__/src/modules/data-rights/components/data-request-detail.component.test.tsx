/**
 * DataRequestDetail — the admin attends a data request (spec 017, HU-03).
 *
 * Guards:
 * - CA-11: a correction links to the customer's record (name and phone) and changes here the email
 *   of an account with a password; never a Google account's (RN-08). «Marcar atendida» needs the
 *   answer for the customer.
 * - CA-14: «Rechazar» needs the reason.
 * - CA-12 / CA-13: an erasure is «Suprimir datos», asked first; an open order stops it, said so.
 * - CA-17: an inquiry offers the download of the customer's data.
 * - CA-19: a closed request is only read.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import {
  correctCustomerEmail,
  eraseCustomerData,
  rejectDataRequest,
  resolveDataRequest,
} from '@web/modules/data-rights/actions/data-rights.actions';
import DataRequestDetail from '@web/modules/data-rights/components/organisms/data-request-detail.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

import { buildDataRequest } from './admin-builders';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/data-rights/actions/data-rights.actions', () => ({
  correctCustomerEmail: vi.fn(),
  eraseCustomerData: vi.fn(),
  rejectDataRequest: vi.fn(),
  resolveDataRequest: vi.fn(),
}));

describe('DataRequestDetail', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows what was asked, by whom and by when, with the customer’s record (CA-09, CA-11)', () => {
    renderWithProviders(<DataRequestDetail request={buildDataRequest()} openOrder={null} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Corrección · Camila Cliente' })
    ).toBeVisible();
    expect(screen.getByText('Mi correo es otro')).toBeVisible();
    expect(screen.getByText('16 de diciembre de 2026')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver la ficha de Camila Cliente' })).toHaveAttribute(
      'href',
      '/customers/c1'
    );
  });

  it('changes the email of an account with a password (CA-11)', async () => {
    vi.mocked(correctCustomerEmail).mockResolvedValue({ ok: true });
    renderWithProviders(<DataRequestDetail request={buildDataRequest()} openOrder={null} />);

    fireEvent.change(screen.getByLabelText('Correo nuevo'), {
      target: { value: 'camila.nueva@correo.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar correo' }));

    expect(await inToasts().findByText('Correo actualizado.')).toBeVisible();
    expect(correctCustomerEmail).toHaveBeenCalledWith({
      customerId: 'c1',
      email: 'camila.nueva@correo.test',
    });
  });

  it('never offers to change a Google account’s email, and says why (RN-08)', () => {
    renderWithProviders(
      <DataRequestDetail
        request={buildDataRequest({ customer_origin: 'google' })}
        openOrder={null}
      />
    );

    expect(screen.queryByLabelText('Correo nuevo')).not.toBeInTheDocument();
    expect(screen.getByText(/Es una cuenta de Google: su correo lo pone Google/)).toBeVisible();
  });

  it('attends with the answer for the customer, required (CA-11)', async () => {
    vi.mocked(resolveDataRequest).mockResolvedValue({ ok: true });
    renderWithProviders(<DataRequestDetail request={buildDataRequest()} openOrder={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Marcar atendida' }));
    expect(await screen.findByText('Escribe la respuesta o el motivo.')).toBeVisible();
    expect(resolveDataRequest).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Respuesta o motivo para el cliente'), {
      target: { value: 'Actualizamos tu correo.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar atendida' }));

    expect(await inToasts().findByText('Solicitud atendida.')).toBeVisible();
    expect(resolveDataRequest).toHaveBeenCalledWith({
      id: 'r1',
      response: 'Actualizamos tu correo.',
    });
  });

  it('rejects with the reason (CA-14)', async () => {
    vi.mocked(rejectDataRequest).mockResolvedValue({ ok: true });
    renderWithProviders(<DataRequestDetail request={buildDataRequest()} openOrder={null} />);

    fireEvent.change(screen.getByLabelText('Respuesta o motivo para el cliente'), {
      target: { value: 'Hay un deber legal de conservarlo.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(await inToasts().findByText('Solicitud rechazada.')).toBeVisible();
    expect(rejectDataRequest).toHaveBeenCalledWith({
      id: 'r1',
      response: 'Hay un deber legal de conservarlo.',
    });
  });

  it('erases only after asking, and never attends an erasure with just an answer (CA-12)', async () => {
    vi.mocked(eraseCustomerData).mockResolvedValue({ ok: true });
    renderWithProviders(
      <DataRequestDetail
        request={buildDataRequest({ kind: 'erasure', description: null })}
        openOrder={null}
      />
    );

    expect(screen.queryByRole('button', { name: 'Marcar atendida' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suprimir datos' }));
    const dialog = await screen.findByRole('dialog', {
      name: '¿Suprimir los datos de Camila Cliente?',
    });
    expect(eraseCustomerData).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suprimir datos' }));

    expect(await inToasts().findByText('Datos suprimidos.')).toBeVisible();
    expect(eraseCustomerData).toHaveBeenCalledWith({ id: 'r1' });
  });

  it('says which open order stops the erasure, with no button to erase (CA-13)', () => {
    renderWithProviders(
      <DataRequestDetail request={buildDataRequest({ kind: 'erasure' })} openOrder={4} />
    );

    expect(
      screen.getByText(
        'Tiene la orden #4 abierta: ciérrala o anúlala para poder suprimir sus datos.'
      )
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Suprimir datos' })).not.toBeInTheDocument();
  });

  it('offers the download of the customer’s data for an inquiry (CA-17)', () => {
    renderWithProviders(
      <DataRequestDetail request={buildDataRequest({ kind: 'inquiry' })} openOrder={null} />
    );

    expect(screen.getByRole('link', { name: 'Descargar sus datos' })).toHaveAttribute(
      'href',
      '/customers/c1/data/export'
    );
  });

  it('only shows a closed request, with its answer and who attended it (CA-19)', () => {
    renderWithProviders(
      <DataRequestDetail
        request={buildDataRequest({
          status: 'attended',
          response: 'Actualizamos tu correo.',
          resolved_by_name: 'Sebastián Pulido',
          resolved_at: '2026-11-25T15:00:00Z',
        })}
        openOrder={null}
      />
    );

    expect(screen.getByText('Actualizamos tu correo.')).toBeVisible();
    expect(screen.getByText(/Sebastián Pulido/)).toBeVisible();
    expect(screen.getByText(/queda como constancia y no se puede cambiar/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Marcar atendida' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('keeps a refusal of the database on the page (spec 013)', async () => {
    vi.mocked(correctCustomerEmail).mockResolvedValue({ ok: false, error: 'emailTaken' });
    renderWithProviders(<DataRequestDetail request={buildDataRequest()} openOrder={null} />);

    fireEvent.change(screen.getByLabelText('Correo nuevo'), {
      target: { value: 'otro@correo.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar correo' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ese correo ya lo usa otra cuenta.')
    );
  });
});
