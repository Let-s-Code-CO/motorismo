/**
 * CatalogNameDialog — the admin renames a brand or a line (spec 018, HU-02), or registers one that
 * is missing (HU-06, CA-26 to CA-28), with the same rules for the name.
 *
 * Guards:
 * - CA-10: the name is required and has at most 60 characters; the error shows by the field and
 *   nothing is sent.
 * - CA-09: a name another one has is refused by the database; the reason stays inside the dialog
 *   (project standard: a form's errors stay in the form).
 * - CA-11: once saved, a floating notice says the new name (spec 013), the dialog closes and the
 *   screen reloads its data.
 * - Without network, nothing happens (spec 006): no notice, the dialog stays as it was.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';

import {
  addVehicleBrand,
  addVehicleLine,
  renameVehicleBrand,
  renameVehicleLine,
} from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import CatalogNameDialog, {
  type CatalogNameTarget,
} from '@web/modules/vehicles/components/molecules/catalog-name-dialog.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/vehicles/actions/vehicle-catalog.actions', () => ({
  addVehicleBrand: vi.fn(),
  addVehicleLine: vi.fn(),
  renameVehicleBrand: vi.fn(),
  renameVehicleLine: vi.fn(),
}));

const onClose = vi.fn();
const BRAND = {
  kind: 'renameBrand' as const,
  id: '6f1d2c3b-4a59-4e8f-9b0a-1c2d3e4f5a6b',
  name: 'Royal Enfiel',
};

const renderDialog = (target: CatalogNameTarget = BRAND) =>
  renderWithProviders(<CatalogNameDialog target={target} onClose={onClose} />);

const nameField = () => screen.getByRole('textbox', { name: 'Nombre' });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

describe('CatalogRenameDialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('asks for the new name of the brand, starting from the current one', () => {
    renderDialog();

    expect(
      screen.getByRole('dialog', { name: 'Renombrar la marca «Royal Enfiel»' })
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue('Royal Enfiel');
  });

  it('does not send an empty name, and says so by the field (CA-10)', async () => {
    renderDialog();

    fireEvent.change(nameField(), { target: { value: '   ' } });
    save();

    await waitFor(() => expect(screen.getByText('Escribe el nombre.')).toBeVisible());
    expect(renameVehicleBrand).not.toHaveBeenCalled();
  });

  it('does not send a name of 61 characters (CA-10)', async () => {
    renderDialog();

    fireEvent.change(nameField(), { target: { value: 'a'.repeat(61) } });
    save();

    await waitFor(() =>
      expect(screen.getByText('El nombre puede tener hasta 60 caracteres.')).toBeVisible()
    );
    expect(renameVehicleBrand).not.toHaveBeenCalled();
  });

  it('keeps inside the dialog the refusal of a name another brand has (CA-09)', async () => {
    vi.mocked(renameVehicleBrand).mockResolvedValue({ ok: false, error: 'nameTaken' });
    renderDialog();

    fireEvent.change(nameField(), { target: { value: 'Suzuki' } });
    save();

    await waitFor(() =>
      expect(
        screen.getByText('Ya existe una con ese nombre. Si son la misma, únelas.')
      ).toBeVisible()
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renames the brand, says its new name, closes and reloads (CA-07, CA-11)', async () => {
    vi.mocked(renameVehicleBrand).mockResolvedValue({ ok: true });
    renderDialog();

    fireEvent.change(nameField(), { target: { value: ' Royal Enfield ' } });
    save();

    expect(await inToasts().findByText('Ahora se llama «Royal Enfield».')).toBeVisible();
    expect(renameVehicleBrand).toHaveBeenCalledWith({ id: BRAND.id, name: 'Royal Enfield' });
    expect(onClose).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('renames a line with the line action (CA-08)', async () => {
    vi.mocked(renameVehicleLine).mockResolvedValue({ ok: true });
    renderDialog({ kind: 'renameLine', id: BRAND.id, name: 'Clasica Mtrs' });

    expect(
      screen.getByRole('dialog', { name: 'Renombrar la línea «Clasica Mtrs»' })
    ).toBeInTheDocument();
    fireEvent.change(nameField(), { target: { value: 'Clásica 350' } });
    save();

    await waitFor(() =>
      expect(renameVehicleLine).toHaveBeenCalledWith({ id: BRAND.id, name: 'Clásica 350' })
    );
    expect(renameVehicleBrand).not.toHaveBeenCalled();
  });

  it('does nothing without network: no notice, the dialog stays (spec 006)', async () => {
    vi.mocked(renameVehicleBrand).mockRejectedValue(new TypeError('Failed to fetch'));
    renderDialog();

    fireEvent.change(nameField(), { target: { value: 'Royal Enfield' } });
    save();

    await waitFor(() => expect(renameVehicleBrand).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(inToasts().queryByText(/Ahora se llama/)).not.toBeInTheDocument();
  });

  it('registers a brand of the type, starting empty, and says so (CA-26)', async () => {
    vi.mocked(addVehicleBrand).mockResolvedValue({ ok: true });
    renderDialog({ kind: 'addBrand', type: 'motorcycle' });

    expect(
      screen.getByRole('dialog', { name: 'Registrar una marca de motocicleta' })
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue('');
    fireEvent.change(nameField(), { target: { value: ' Voge ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(await inToasts().findByText('Se registró «Voge».')).toBeVisible();
    expect(addVehicleBrand).toHaveBeenCalledWith({ type: 'motorcycle', name: 'Voge' });
  });

  it('registers a line of the brand (CA-27)', async () => {
    vi.mocked(addVehicleLine).mockResolvedValue({ ok: true });
    renderDialog({ kind: 'addLine', brandId: BRAND.id, brandName: 'KTM' });

    expect(screen.getByRole('dialog', { name: 'Registrar una línea de KTM' })).toBeInTheDocument();
    fireEvent.change(nameField(), { target: { value: '390 Duke' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() =>
      expect(addVehicleLine).toHaveBeenCalledWith({ brandId: BRAND.id, name: '390 Duke' })
    );
  });

  it('does not register an empty name (CA-28)', async () => {
    renderDialog({ kind: 'addBrand', type: 'car' });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(screen.getByText('Escribe el nombre.')).toBeVisible());
    expect(addVehicleBrand).not.toHaveBeenCalled();
  });
});
