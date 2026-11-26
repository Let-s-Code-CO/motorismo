/**
 * PlateLegendDialog — an admin writes how a city's name reads on its plates (spec 023, CA-10).
 *
 * Guards:
 * - the sample plate shows the legend as it is typed, raised to capitals;
 * - saving sends the city and the legend and says «Leyenda guardada.»; «Quitar leyenda» clears it and
 *   says «Leyenda quitada.» (the plate shows the name again);
 * - a legend that does not fit the plate is reported next to the field and nothing is sent; a refusal
 *   of the database stays in the dialog (spec 013).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { setPlateLegend } from '@web/modules/vehicles/actions/plate-cities.actions';
import PlateLegendDialog from '@web/modules/vehicles/components/molecules/plate-legend-dialog.component';
import type { PlateCity } from '@web/modules/vehicles/types/vehicles.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/vehicles/actions/plate-cities.actions', () => ({ setPlateLegend: vi.fn() }));

const bogota: PlateCity = {
  code: '11001',
  name: 'Bogotá, D.C.',
  department: 'Bogotá, D.C.',
  plate_legend: null,
};

const open = (city = bogota) => {
  const onClose = vi.fn();
  renderWithProviders(<PlateLegendDialog city={city} onClose={onClose} />);
  return { onClose, field: () => screen.getByLabelText('Leyenda en la placa') };
};

describe('PlateLegendDialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the sample plate with the legend as it is typed, in capitals', async () => {
    const { field } = open();
    const legend = () => document.querySelector<HTMLElement>('[data-plate]')?.dataset.legend;
    await waitFor(() => expect(legend()).toBe('BOGOTA, D.C.'));

    fireEvent.change(field(), { target: { value: 'stfe de bogota' } });

    expect(legend()).toBe('STFE DE BOGOTA');
  });

  it('saves the legend and says so (CA-10)', async () => {
    vi.mocked(setPlateLegend).mockResolvedValue({ ok: true });
    const { field, onClose } = open();

    fireEvent.change(field(), { target: { value: 'STFE DE BOGOTA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(setPlateLegend).toHaveBeenCalledWith({ code: '11001', legend: 'STFE DE BOGOTA' })
    );
    expect(await inToasts().findByText('Leyenda guardada.')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('clears an existing legend with «Quitar leyenda» (CA-10)', async () => {
    vi.mocked(setPlateLegend).mockResolvedValue({ ok: true });
    open({ ...bogota, plate_legend: 'STFE DE BOGOTA' });

    fireEvent.click(await screen.findByRole('button', { name: 'Quitar leyenda' }));

    await waitFor(() => expect(setPlateLegend).toHaveBeenCalledWith({ code: '11001', legend: '' }));
    expect(await inToasts().findByText('Leyenda quitada.')).toBeInTheDocument();
  });

  it('reports a legend that does not fit and sends nothing (RN-05)', async () => {
    const { field } = open();

    fireEvent.change(field(), { target: { value: 'BOGOTÁ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escríbela sin tildes, como en la placa.')).toBeInTheDocument();
    expect(setPlateLegend).not.toHaveBeenCalled();
  });

  it('keeps a refusal of the database inside the dialog (spec 013)', async () => {
    vi.mocked(setPlateLegend).mockResolvedValue({ ok: false, error: 'notIssuing' });
    const { field } = open();

    fireEvent.change(field(), { target: { value: 'BOGOTA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('Esta ciudad no expide placas: no lleva leyenda.')
    ).toBeInTheDocument();
  });
});
