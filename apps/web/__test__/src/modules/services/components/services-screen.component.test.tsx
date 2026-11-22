/**
 * ServicesScreen — «Servicios»: the catalog for an admin, read-only for an operator (spec 007).
 *
 * Guards:
 * - CA-06: with no services, an admin is invited to register the first one.
 * - CA-12: disabling asks first, then announces the result, as a floating notice (spec 013,
 *   CA-01); a refusal too, until closed (spec 013, CA-07); with no network, nothing of its own
 *   (spec 013, CA-09).
 * - CA-13: the disabled services are apart, in «Desactivados», where they can be reactivated.
 * - CA-15: an operator sees the services without any way to register, correct or disable them.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { setServiceDisabled } from '@web/modules/services/actions/services.actions';
import type { ServiceRow } from '@web/modules/services/api/services.server';
import ServicesScreen from '@web/modules/services/components/organisms/services-screen.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@web/modules/services/actions/services.actions', () => ({
  createService: vi.fn(),
  updateService: vi.fn(),
  setServiceDisabled: vi.fn(),
}));

const service = (overrides: Partial<ServiceRow> = {}): ServiceRow => ({
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Lavado sencillo',
  price_motorcycle: 25000,
  price_car: 40000,
  price_bicycle: 15000,
  estimated_minutes: null,
  disabled_at: null,
  ...overrides,
});

const polichado = service({
  id: '20000000-0000-4000-8000-000000000002',
  name: 'Polichado',
  disabled_at: '2026-10-21T15:00:00Z',
});

describe('ServicesScreen', () => {
  afterEach(() => vi.clearAllMocks());

  it('invites an admin to register the first service when there is none (CA-06)', () => {
    renderWithProviders(<ServicesScreen services={[]} isAdmin />);

    expect(
      screen.getByText('Aún no hay servicios. Registra el primero con «Nuevo servicio».')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nuevo servicio' })).toBeVisible();
  });

  it('asks before disabling a service, then announces it (CA-12)', async () => {
    vi.mocked(setServiceDisabled).mockResolvedValue({ ok: true });
    renderWithProviders(<ServicesScreen services={[service()]} isAdmin />);

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Lavado sencillo' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar' }));
    expect(setServiceDisabled).not.toHaveBeenCalled();

    await screen.findByRole('dialog', { name: /¿Desactivar «Lavado sencillo»?/ });
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(await inToasts().findByText('Servicio desactivado.')).toBeVisible();
    expect(setServiceDisabled).toHaveBeenCalledWith({
      id: '20000000-0000-4000-8000-000000000001',
      disabled: true,
    });
  });

  const disableLavado = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Lavado sencillo' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar' }));
    await screen.findByRole('dialog', { name: /¿Desactivar «Lavado sencillo»?/ });
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
  };

  it('says a refusal in a floating notice that stays (spec 013, CA-07)', async () => {
    vi.mocked(setServiceDisabled).mockResolvedValue({ ok: false, error: 'generic' });
    renderWithProviders(<ServicesScreen services={[service()]} isAdmin />);

    await disableLavado();

    expect(await inToasts().findByText('No se pudo guardar. Inténtalo de nuevo.')).toBeVisible();
  });

  it('says nothing of its own with no network (spec 013, CA-09)', async () => {
    vi.mocked(setServiceDisabled).mockRejectedValue(new TypeError('Failed to fetch'));
    renderWithProviders(<ServicesScreen services={[service()]} isAdmin />);

    await disableLavado();

    await waitFor(() => expect(setServiceDisabled).toHaveBeenCalled());
    expect(screen.getByRole('region', { name: 'Avisos' })).toHaveTextContent('');
  });

  it('keeps the disabled services apart, in «Desactivados», where they are reactivated (CA-13)', async () => {
    vi.mocked(setServiceDisabled).mockResolvedValue({ ok: true });
    renderWithProviders(<ServicesScreen services={[service(), polichado]} isAdmin />);

    expect(screen.queryByRole('row', { name: /Polichado/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desactivados (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Polichado' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reactivar' }));

    expect(await inToasts().findByText('Servicio reactivado.')).toBeVisible();
    expect(setServiceDisabled).toHaveBeenCalledWith({ id: polichado.id, disabled: false });
  });

  it('lets an operator only read: no «Nuevo servicio», no actions (CA-15)', () => {
    renderWithProviders(<ServicesScreen services={[service()]} isAdmin={false} />);

    expect(screen.getByRole('row', { name: /Lavado sencillo/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Nuevo servicio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Acciones de/ })).not.toBeInTheDocument();
  });
});
