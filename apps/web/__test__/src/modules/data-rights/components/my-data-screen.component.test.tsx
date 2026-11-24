/**
 * MyDataScreen — «Mis datos»: what the business keeps of a customer, and their requests about it
 * (spec 017, HU-01, HU-02).
 *
 * Guards:
 * - CA-01: their profile and account, when they authorised the processing (with the policy), their
 *   vehicles (also retired), orders (also voided), reservations and requests.
 * - CA-02: «Descargar mis datos» downloads the file.
 * - CA-04: a correction says what to correct; reminded that name and phone are theirs to change.
 * - CA-05: before asking for the erasure, they are told what will happen; the reason is optional,
 *   the button destructive.
 * - CA-06: a kind already open cannot be asked again, and they are told so.
 * - CA-07 / CA-08: each request with its state, deadline and answer; one received can be withdrawn.
 * - A refusal of the database stays in the dialog, under its button (spec 013).
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import {
  requestCorrection,
  requestErasure,
  withdrawDataRequest,
} from '@web/modules/data-rights/actions/data-rights.actions';
import MyDataScreen from '@web/modules/data-rights/components/organisms/my-data-screen.component';
import type { CustomerData, MyDataRequest } from '@web/modules/data-rights/types/data-rights.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/data-rights/actions/data-rights.actions', () => ({
  requestCorrection: vi.fn(),
  requestErasure: vi.fn(),
  withdrawDataRequest: vi.fn(),
}));

const DATA: CustomerData = {
  profile: {
    full_name: 'Camila Cliente',
    email: 'cliente@motorismo.test',
    phone: '3001234567',
    avatar_url: null,
    origin: 'self_signup',
    registered_at: '2026-10-01T15:00:00Z',
    consent_at: '2026-10-01T15:00:00Z',
  },
  vehicles: [
    {
      vehicle_type: 'motorcycle',
      brand: 'Suzuki',
      line: 'GSX-R600',
      plate: 'UIH03D',
      color: 'black',
      retired_at: null,
    },
    {
      vehicle_type: 'motorcycle',
      brand: 'Yamaha',
      line: 'MT-03',
      plate: 'JWJ07',
      color: 'blue',
      retired_at: '2026-10-20T15:00:00Z',
    },
  ],
  orders: [
    {
      number: 2,
      status: 'closed',
      opened_at: '2026-11-20T14:00:00Z',
      closed_at: '2026-11-20T16:00:00Z',
      voided_at: null,
      vehicle: { brand: 'Suzuki', line: 'GSX-R600', plate: 'UIH03D' },
      services: [{ name: 'Lavado sencillo', price: 25000 }],
      discount: 0,
      total: 25000,
      payments: [{ method: 'cash', amount: 25000 }],
    },
    {
      number: 3,
      status: 'voided',
      opened_at: '2026-11-21T14:00:00Z',
      closed_at: null,
      voided_at: '2026-11-21T15:00:00Z',
      vehicle: { brand: 'Suzuki', line: 'GSX-R600', plate: 'UIH03D' },
      services: [{ name: 'Micropulido', price: 120000 }],
      discount: 0,
      total: 120000,
      payments: [],
    },
  ],
  reservations: [
    {
      number: 7,
      status: 'pending',
      slot_start: '2026-11-25T15:00:00Z',
      slot_end: '2026-11-25T16:00:00Z',
      vehicle: { brand: 'Suzuki', line: 'GSX-R600', plate: 'UIH03D' },
      services: ['Lavado detallado'],
      notes: null,
      cancel_reason: null,
    },
  ],
  requests: [],
};

const request = (overrides: Partial<MyDataRequest> = {}): MyDataRequest => ({
  id: 'r1',
  kind: 'correction',
  channel: 'app',
  status: 'received',
  received_at: '2026-11-24T15:00:00Z',
  due_on: '2026-12-16',
  resolved_at: null,
  response: null,
  ...overrides,
});

const renderScreen = (requests: MyDataRequest[] = []) =>
  renderWithProviders(<MyDataScreen data={DATA} requests={requests} />);

const section = (name: string) => screen.getByRole('region', { name });

describe('MyDataScreen', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows their profile, account and when they authorised the processing, with the policy (CA-01)', () => {
    renderScreen();

    const profile = section('Tus datos personales');
    for (const text of [
      'Camila Cliente',
      'cliente@motorismo.test',
      '300 123 4567',
      'Con correo y contraseña',
    ]) {
      expect(within(profile).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(profile).getByText(/Autorizaste el tratamiento de tus datos el 1 de octubre de 2026\./)
    ).toBeVisible();
    expect(
      within(profile).getByRole('link', { name: 'Ver la política de tratamiento de datos' })
    ).toHaveAttribute('href', '/privacy');
  });

  it('shows every vehicle, also the retired one, and every order, also the voided one (CA-01)', () => {
    renderScreen();

    const vehicles = within(section('Tus vehículos')).getAllByRole('listitem');
    expect(vehicles.map((item) => item.textContent)).toEqual([
      'Suzuki GSX-R600 · UIH-03D',
      'Yamaha MT-03 · JWJ-07Retirado',
    ]);
    const orders = within(section('Tus órdenes')).getAllByRole('listitem');
    expect(orders[0]).toHaveTextContent('Orden #2 · Entregada');
    expect(orders[0]).toHaveTextContent('$ 25.000');
    expect(orders[1]).toHaveTextContent('Orden #3 · Anulada');
    expect(
      within(section('Tus reservas')).getByText(/25 nov 2026 · 10:00 a\. m\. · Pendiente/)
    ).toBeVisible();
  });

  it('downloads their data (CA-02)', () => {
    renderScreen();

    expect(screen.getByRole('link', { name: 'Descargar mis datos' })).toHaveAttribute(
      'href',
      '/my/data/export'
    );
  });

  it('asks for a correction with what to correct, reminding them of «Mi perfil» (CA-04)', async () => {
    vi.mocked(requestCorrection).mockResolvedValue({ ok: true });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Pedir una corrección' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pedir una corrección' });
    expect(dialog).toHaveTextContent('Tu nombre y tu celular los cambias tú en «Mi perfil».');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar solicitud' }));
    // The dialog may still be fading in (opacity 0): wait until the message is seen.
    await waitFor(() =>
      expect(within(dialog).getByText('Escribe qué hay que corregir.')).toBeVisible()
    );
    expect(requestCorrection).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('¿Qué hay que corregir?'), {
      target: { value: 'Mi correo es otro' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar solicitud' }));

    expect(await inToasts().findByText('Solicitud enviada.')).toBeVisible();
    expect(requestCorrection).toHaveBeenCalledWith({ description: 'Mi correo es otro' });
    expect(refresh).toHaveBeenCalled();
  });

  it('tells them what an erasure does before they ask, the reason optional (CA-05)', async () => {
    vi.mocked(requestErasure).mockResolvedValue({ ok: true });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Pedir la supresión de mis datos' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Pedir la supresión de tus datos?' });
    expect(dialog).toHaveTextContent('se cerrará tu cuenta');
    expect(dialog).toHaveTextContent(
      'Las órdenes que ya pagaste quedan en las cuentas del negocio'
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Pedir la supresión' }));

    await waitFor(() => expect(requestErasure).toHaveBeenCalledWith({ reason: '' }));
  });

  it('keeps a refusal of the database inside the dialog, under its button (spec 013)', async () => {
    vi.mocked(requestErasure).mockResolvedValue({ ok: false, error: 'alreadyOpen' });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Pedir la supresión de mis datos' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pedir la supresión' }));

    // The dialog may still be fading in (opacity 0): wait until the message is seen.
    await waitFor(() =>
      expect(within(dialog).getByText('Ya hay una solicitud de ese tipo en curso.')).toBeVisible()
    );
  });

  it('does not let them ask again for a kind already open, and says so (CA-06)', () => {
    renderScreen([request({ kind: 'erasure' })]);

    expect(screen.getByRole('button', { name: 'Pedir la supresión de mis datos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pedir una corrección' })).toBeEnabled();
    expect(screen.getByText('Ya pediste la supresión de tus datos.')).toBeVisible();
  });

  it('shows each request with its state, deadline and answer (CA-07)', () => {
    renderScreen([
      request(),
      request({
        id: 'r2',
        kind: 'inquiry',
        status: 'attended',
        response: 'Te enviamos tus datos.',
      }),
    ]);

    const items = within(section('Tus solicitudes')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Corrección del 24 nov 2026');
    expect(items[0]).toHaveTextContent('Recibida');
    expect(items[0]).toHaveTextContent('Te responderemos a más tardar el 16 dic 2026.');
    expect(items[1]).toHaveTextContent('Atendida');
    expect(items[1]).toHaveTextContent('Respuesta: Te enviamos tus datos.');
    expect(within(items[1]!).queryByRole('button', { name: /Retirar/ })).not.toBeInTheDocument();
  });

  it('withdraws a received request, naming it for screen readers (CA-08)', async () => {
    vi.mocked(withdrawDataRequest).mockResolvedValue({ ok: true });
    renderScreen([request()]);

    fireEvent.click(screen.getByRole('button', { name: 'Corrección del 24 nov 2026: Retirar' }));

    expect(await inToasts().findByText('Solicitud retirada.')).toBeVisible();
    expect(withdrawDataRequest).toHaveBeenCalledWith({ id: 'r1' });
  });
});
