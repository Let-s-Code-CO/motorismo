/**
 * CatalogCategoryDialog — the admin sets the category of a motorcycle line in «Marcas y líneas»
 * (spec 024, CA-01).
 *
 * Guards:
 * - it opens on the line's category («Sin categoría» chooses none);
 * - saving sends the line and the category chosen through `callAction`, says so in a floating notice
 *   (spec 013) and refreshes the screen;
 * - a refusal of the database stays inside the dialog.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { setVehicleLineCategory } from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import CatalogCategoryDialog from '@web/modules/vehicles/components/molecules/catalog-category-dialog.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/vehicles/actions/vehicle-catalog.actions', () => ({
  setVehicleLineCategory: vi.fn(),
}));

const LINE = {
  id: '40000000-0000-4000-8000-000000000001',
  name: 'GSX-R600',
  category: 'sbk' as const,
};

const open = (line: typeof LINE | (Omit<typeof LINE, 'category'> & { category: null }) = LINE) => {
  const onClose = vi.fn();
  renderWithProviders(<CatalogCategoryDialog line={line} onClose={onClose} />);
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Categoría de GSX-R600' }) };
};

describe('CatalogCategoryDialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('opens on the category of the line (CA-01)', () => {
    const { dialog } = open();

    expect(within(dialog).getByRole('button', { name: /Categoría/ })).toHaveTextContent('SBK/SSP');
  });

  it('saves the category chosen, says so and refreshes the screen (CA-01)', async () => {
    vi.mocked(setVehicleLineCategory).mockResolvedValue({ ok: true });
    const { dialog, onClose } = open();

    fireEvent.click(within(dialog).getByRole('button', { name: /Categoría/ }));
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: 'Street/Roadster' })
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(setVehicleLineCategory).toHaveBeenCalledWith({ id: LINE.id, category: 'street' })
    );
    expect(await inToasts().findByText('GSX-R600: Street/Roadster.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps a refusal of the database inside the dialog (spec 013)', async () => {
    vi.mocked(setVehicleLineCategory).mockResolvedValue({ ok: false, error: 'notFound' });
    const { dialog } = open();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });
});
