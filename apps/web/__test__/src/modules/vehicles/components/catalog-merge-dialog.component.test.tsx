/**
 * CatalogMergeDialog — the admin merges a brand or a line with the one that stays, or moves a line
 * to another brand (spec 018, HU-03 and HU-04).
 *
 * Guards:
 * - CA-15, CA-20: the choices are only the other brands of the type (merging a brand, moving a
 *   line) or the other lines of the brand (merging a line); never the one being merged or its brand.
 * - CA-12, CA-14, CA-18: before doing it, it says how many vehicles pass and that it cannot be
 *   undone; nothing is sent until one is chosen.
 * - CA-19: moving a line to a brand with an equal line (the catalog's rule) says they will merge.
 * - Done: a floating notice, the dialog closes and the screen reloads; a refusal stays inside.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import {
  mergeVehicleBrands,
  mergeVehicleLines,
  moveVehicleLine,
} from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import CatalogMergeDialog, {
  type CatalogMergeTarget,
} from '@web/modules/vehicles/components/molecules/catalog-merge-dialog.component';
import type { CatalogBrand, CatalogLine } from '@web/modules/vehicles/types/vehicle-catalog.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/vehicles/actions/vehicle-catalog.actions', () => ({
  mergeVehicleBrands: vi.fn(),
  mergeVehicleLines: vi.fn(),
  moveVehicleLine: vi.fn(),
}));

const onClose = vi.fn();
const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const buildLine = (overrides: Partial<CatalogLine> = {}): CatalogLine => ({
  id: uuid(0),
  name: 'Línea',
  reviewed: true,
  created_at: '2026-11-19T15:00:00Z',
  vehicles: 0,
  ...overrides,
});
const buildBrand = (overrides: Partial<CatalogBrand> = {}): CatalogBrand => ({
  ...buildLine(),
  lines: [],
  ...overrides,
});

const FZ = buildLine({ id: uuid(5), name: 'Fz 2.0', reviewed: false, vehicles: 3 });
const HONDA = buildBrand({
  id: uuid(1),
  name: 'Honda',
  lines: [
    buildLine({ id: uuid(4), name: 'CB 190R' }),
    FZ,
    buildLine({ id: uuid(6), name: 'Wave' }),
  ],
});
const SUZUKI = buildBrand({ id: uuid(2), name: 'Suzuki' });
const SUZUKY = buildBrand({ id: uuid(3), name: 'Suzuky', reviewed: false, vehicles: 2 });
const YAMAHA = buildBrand({
  id: uuid(7),
  name: 'Yamaha',
  lines: [buildLine({ id: uuid(8), name: 'FZ 2.0' })],
});
const BRANDS = [HONDA, SUZUKI, SUZUKY, YAMAHA];

const renderDialog = (target: CatalogMergeTarget) =>
  renderWithProviders(<CatalogMergeDialog target={target} brands={BRANDS} onClose={onClose} />);

/** Opens the whole list as a keyboard user does: focus the field and press the down arrow. */
const openList = async (field: string) => {
  const input = screen.getByRole('combobox', { name: field });
  act(() => input.focus());
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  return within(await screen.findByRole('listbox'));
};
const choose = async (field: string, option: string) => {
  fireEvent.click((await openList(field)).getByRole('option', { name: option }));
};
const optionNames = async (field: string) =>
  (await openList(field)).getAllByRole('option').map((option) => option.textContent);

describe('CatalogMergeDialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('offers to merge a brand only with the other brands of its type (CA-15)', async () => {
    renderDialog({ kind: 'mergeBrand', brand: SUZUKY });

    expect(screen.getByRole('dialog', { name: 'Unir la marca «Suzuky»' })).toBeInTheDocument();
    expect(await optionNames('Marca que queda')).toEqual(['Honda', 'Suzuki', 'Yamaha']);
  });

  it('sends nothing until the one that stays is chosen', () => {
    renderDialog({ kind: 'mergeBrand', brand: SUZUKY });

    expect(screen.getByRole('button', { name: 'Unir' })).toBeDisabled();
  });

  it('says how many vehicles pass and that it cannot be undone, then merges (CA-12)', async () => {
    vi.mocked(mergeVehicleBrands).mockResolvedValue({ ok: true });
    renderDialog({ kind: 'mergeBrand', brand: SUZUKY });

    await choose('Marca que queda', 'Suzuki');

    await waitFor(() =>
      expect(screen.getByText(/2 vehículos pasan a Suzuki\. «Suzuky» desaparece/)).toBeVisible()
    );
    expect(screen.getByText('No se puede deshacer.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Unir' }));

    expect(await inToasts().findByText('«Suzuky» se unió con Suzuki.')).toBeVisible();
    expect(mergeVehicleBrands).toHaveBeenCalledWith({ from: SUZUKY.id, into: SUZUKI.id });
    expect(onClose).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('offers to merge a line only with the other lines of its brand (CA-14, CA-15)', async () => {
    renderDialog({ kind: 'mergeLine', brand: HONDA, line: FZ });

    expect(screen.getByRole('dialog', { name: 'Unir la línea «Fz 2.0»' })).toBeInTheDocument();
    expect(await optionNames('Línea que queda')).toEqual(['CB 190R', 'Wave']);
  });

  it('merges a line with the one chosen (CA-14)', async () => {
    vi.mocked(mergeVehicleLines).mockResolvedValue({ ok: true });
    renderDialog({ kind: 'mergeLine', brand: HONDA, line: FZ });

    await choose('Línea que queda', 'Wave');
    await waitFor(() =>
      expect(screen.getByText(/3 vehículos pasan a Wave\. «Fz 2\.0» desaparece/)).toBeVisible()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unir' }));

    await waitFor(() =>
      expect(mergeVehicleLines).toHaveBeenCalledWith({ from: FZ.id, into: uuid(6) })
    );
  });

  it('offers to move a line only to the other brands of its type (CA-20)', async () => {
    renderDialog({ kind: 'moveLine', brand: HONDA, line: FZ });

    expect(
      screen.getByRole('dialog', { name: 'Pasar la línea «Fz 2.0» a otra marca' })
    ).toBeInTheDocument();
    expect(await optionNames('Marca de destino')).toEqual(['Suzuki', 'Suzuky', 'Yamaha']);
  });

  it('says a moved line will merge with the equal one of the brand chosen, then moves it (CA-18, CA-19)', async () => {
    vi.mocked(moveVehicleLine).mockResolvedValue({ ok: true });
    renderDialog({ kind: 'moveLine', brand: HONDA, line: FZ });

    await choose('Marca de destino', 'Yamaha');

    await waitFor(() =>
      expect(screen.getByText(/3 vehículos pasan a ser Yamaha Fz 2\.0\./)).toBeVisible()
    );
    expect(screen.getByText('Se unirá con la línea «FZ 2.0» de Yamaha.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pasar' }));

    expect(await inToasts().findByText('«Fz 2.0» pasó a Yamaha.')).toBeVisible();
    expect(moveVehicleLine).toHaveBeenCalledWith({ lineId: FZ.id, brandId: YAMAHA.id });
  });

  it('does not say they will merge when the brand chosen has no equal line (CA-18)', async () => {
    renderDialog({ kind: 'moveLine', brand: HONDA, line: FZ });

    await choose('Marca de destino', 'Suzuki');

    expect(screen.queryByText(/Se unirá con la línea/)).not.toBeInTheDocument();
  });

  it('keeps a refusal inside the dialog', async () => {
    vi.mocked(mergeVehicleBrands).mockResolvedValue({ ok: false, error: 'typeMismatch' });
    renderDialog({ kind: 'mergeBrand', brand: SUZUKY });

    await choose('Marca que queda', 'Suzuki');
    fireEvent.click(screen.getByRole('button', { name: 'Unir' }));

    await waitFor(() =>
      expect(
        screen.getByText('Solo se une con una marca del mismo tipo de vehículo.')
      ).toBeVisible()
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
