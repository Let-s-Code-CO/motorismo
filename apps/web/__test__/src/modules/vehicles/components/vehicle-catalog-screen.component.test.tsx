/**
 * VehicleCatalogScreen — «Marcas y líneas», where the admin reviews the brands and lines of each type
 * and corrects them (spec 018, HU-01).
 *
 * Guards:
 * - CA-01: the brands of the type, in the order they come (alphabetical), each with how many
 *   vehicles use it; the type is chosen with links (it lives in the address).
 * - CA-02: a brand opens to show its lines, each with its count.
 * - CA-03: a brand or line to review says «Por revisar» with the date it was added; the cards «Por
 *   revisar» and «Revisadas» count and filter (project standard: the filter in the address, pressed again it
 *   clears).
 * - CA-04: the search waits until the person stops typing, looks in brands and lines, and says when
 *   nothing matches; a search that matches a line shows the lines.
 * - Each brand and line has its actions (rename, merge, move a line), which open their dialog; one
 *   to review can be marked reviewed at once, and a brand can get a new line (HU-06).
 * - «Registrar marca» opens the dialog to register a brand of the type shown (HU-06, CA-26).
 */
import { usePathname } from 'next/navigation';

import { act, fireEvent, screen, within } from '@testing-library/react';

import { markVehicleBrandReviewed } from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import VehicleCatalogScreen from '@web/modules/vehicles/components/organisms/vehicle-catalog-screen.component';
import type {
  CatalogBrand,
  CatalogLine,
  VehicleCatalogFilters,
} from '@web/modules/vehicles/types/vehicle-catalog.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/admin/vehicle-catalog'),
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@web/modules/vehicles/actions/vehicle-catalog.actions', () => ({
  addVehicleBrand: vi.fn(),
  addVehicleLine: vi.fn(),
  markVehicleBrandReviewed: vi.fn(),
  markVehicleLineReviewed: vi.fn(),
  renameVehicleBrand: vi.fn(),
  renameVehicleLine: vi.fn(),
  mergeVehicleBrands: vi.fn(),
  mergeVehicleLines: vi.fn(),
  moveVehicleLine: vi.fn(),
}));

const buildLine = (overrides: Partial<CatalogLine> = {}): CatalogLine => ({
  id: 'line',
  name: 'Línea',
  reviewed: true,
  created_at: '2026-11-19T15:00:00Z',
  vehicles: 0,
  ...overrides,
});

const buildBrand = (overrides: Partial<CatalogBrand> = {}): CatalogBrand => ({
  id: 'brand',
  name: 'Marca',
  reviewed: true,
  created_at: '2026-11-19T15:00:00Z',
  vehicles: 0,
  lines: [],
  ...overrides,
});

const BRANDS: CatalogBrand[] = [
  buildBrand({
    id: 'honda',
    name: 'Honda',
    vehicles: 3,
    lines: [
      buildLine({ id: 'cb', name: 'CB 190R', vehicles: 2 }),
      buildLine({
        id: 'fz',
        name: 'Fz 2.0',
        reviewed: false,
        created_at: '2026-11-20T15:00:00Z',
        vehicles: 1,
      }),
    ],
  }),
  buildBrand({
    id: 'suzuki',
    name: 'Suzuki',
    vehicles: 1,
    lines: [buildLine({ id: 'gsx', name: 'GSX-R600', vehicles: 1 })],
  }),
  buildBrand({
    id: 'suzuky',
    name: 'Suzuky',
    reviewed: false,
    created_at: '2026-11-21T15:00:00Z',
    vehicles: 2,
  }),
];

const buildFilters = (overrides: Partial<VehicleCatalogFilters> = {}): VehicleCatalogFilters => ({
  type: 'motorcycle',
  status: null,
  q: '',
  ...overrides,
});

const renderScreen = (filters = buildFilters()) =>
  renderWithProviders(<VehicleCatalogScreen filters={filters} brands={BRANDS} />);

/** Each brand opens with its button «Ver líneas de …»: its names, in the order listed. */
const brandNames = () =>
  screen
    .getAllByRole('button', { name: /^Ver líneas de / })
    .map(
      (button) =>
        button.getAttribute('aria-label') ?? button.textContent?.replace('Ver líneas de ', '')
    );
const brandItem = (name: string) =>
  screen.getByRole('button', { name: `Ver líneas de ${name}` }).closest('li')!;

describe('VehicleCatalogScreen', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/admin/vehicle-catalog');
  });

  it('lists the brands in their order, each with how many vehicles use it (CA-01)', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: 'Marcas y líneas', level: 1 })).toBeVisible();
    expect(brandNames()).toEqual(['Honda', 'Suzuki', 'Suzuky']);
    expect(brandItem('Honda')).toHaveTextContent('3 vehículos');
    expect(brandItem('Suzuki')).toHaveTextContent('1 vehículo');
  });

  it('chooses the type with links that keep it in the address, the current one marked (CA-01)', () => {
    renderScreen();
    const types = screen.getByRole('navigation', { name: 'Tipo de vehículo' });

    expect(within(types).getByRole('link', { name: 'Motocicleta' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(types).getByRole('link', { name: 'Carro' })).toHaveAttribute(
      'href',
      '/admin/vehicle-catalog?type=car'
    );
  });

  it('marks a brand to review with «Por revisar» and the date it was added, and not a reviewed one (CA-03)', () => {
    renderScreen();

    expect(brandItem('Suzuky')).toHaveTextContent(/Por revisar · 21 nov/);
    expect(brandItem('Suzuki')).not.toHaveTextContent('Por revisar');
  });

  it('says on a reviewed brand how many of its lines are to review, why it is under «Por revisar» (CA-03)', () => {
    renderScreen();

    expect(brandItem('Honda')).toHaveTextContent('1 línea por revisar');
    expect(brandItem('Suzuki')).not.toHaveTextContent('por revisar');
  });

  it('opens a brand to show its lines, each with its count and origin (CA-02, CA-03)', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Ver líneas de Honda' }));

    const lines = screen.getByRole('list', { name: 'Líneas de Honda' });
    expect(within(lines).getByText('CB 190R').closest('li')).toHaveTextContent('2 vehículos');
    expect(within(lines).getByText('Fz 2.0').closest('li')).toHaveTextContent(
      /Por revisar · 20 nov/
    );
  });

  it('counts the brands to review and the reviewed ones on its cards; Honda counts in both (CA-03)', () => {
    renderScreen();

    expect(screen.getByRole('button', { name: /^Por revisar 2$/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: /^Revisadas 2$/ })).toBeVisible();
  });

  it('filters by a card through the address (CA-03)', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /^Por revisar 2$/ }));

    expect(replace).toHaveBeenCalledWith('/admin/vehicle-catalog?status=pending', {
      scroll: false,
    });
  });

  it('shows the brands of the card of the address, and says how many of how many (CA-03)', () => {
    renderScreen(buildFilters({ status: 'pending' }));

    expect(brandNames()).toEqual(['Honda', 'Suzuky']);
    expect(screen.getByText('2 de 3 marcas · Por revisar')).toBeVisible();
    expect(screen.getByRole('button', { name: /^Por revisar 2$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('searches 300 ms after the last key, keeping the type and the card (CA-04)', () => {
    renderScreen(buildFilters({ type: 'motorcycle', status: 'pending' }));

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar marcas y líneas' }), {
      target: { value: 'suz' },
    });
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(replace).toHaveBeenCalledWith('/admin/vehicle-catalog?status=pending&q=suz', {
      scroll: false,
    });
  });

  it('shows the lines of the brands a search finds, to see the line that matched (CA-04)', () => {
    renderScreen(buildFilters({ q: 'gsx' }));

    expect(brandNames()).toEqual(['Suzuki']);
    expect(
      within(screen.getByRole('list', { name: 'Líneas de Suzuki' })).getByText('GSX-R600')
    ).toBeVisible();
  });

  it('says when nothing matches the search (CA-04)', () => {
    renderScreen(buildFilters({ q: 'ducati' }));

    expect(screen.getByText('No hay marcas ni líneas que coincidan.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Marcas' })).not.toBeInTheDocument();
  });

  it('offers on a brand to review «Renombrar», «Dar por revisada», «Registrar línea» and «Unir con otra marca», and opens the dialog (HU-02, HU-03, HU-06)', async () => {
    vi.useRealTimers(); // The menu opens with its own timers.
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Suzuky' }));
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Renombrar', 'Dar por revisada', 'Registrar línea', 'Unir con otra marca']);

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Renombrar' }));

    expect(
      await screen.findByRole('dialog', { name: 'Renombrar la marca «Suzuky»' })
    ).toBeInTheDocument();
  });

  it('offers on a line to review «Renombrar», «Dar por revisada», «Unir con otra línea» and «Pasar a otra marca» (HU-02 to HU-04, HU-06)', async () => {
    vi.useRealTimers(); // The menu opens with its own timers.
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Ver líneas de Honda' }));

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de la línea Fz 2.0' }));

    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Renombrar', 'Dar por revisada', 'Unir con otra línea', 'Pasar a otra marca']);
  });

  it('offers on a reviewed brand no «Dar por revisada» (CA-29)', async () => {
    vi.useRealTimers(); // The menu opens with its own timers.
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Suzuki' }));

    const menu = await screen.findByRole('menu');
    expect(
      within(menu).queryByRole('menuitem', { name: 'Dar por revisada' })
    ).not.toBeInTheDocument();
  });

  it('marks a brand reviewed at once and says so (CA-29)', async () => {
    vi.useRealTimers();
    vi.mocked(markVehicleBrandReviewed).mockResolvedValue({ ok: true });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Suzuky' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Dar por revisada' }));

    expect(await inToasts().findByText('«Suzuky» quedó revisada.')).toBeVisible();
    expect(markVehicleBrandReviewed).toHaveBeenCalledWith({ id: 'suzuky' });
  });

  it('opens the dialog to register a brand of the type shown (CA-26)', async () => {
    vi.useRealTimers();
    renderScreen(buildFilters({ type: 'car' }));

    fireEvent.click(screen.getByRole('button', { name: 'Registrar marca' }));

    expect(
      await screen.findByRole('dialog', { name: 'Registrar una marca de carro' })
    ).toBeInTheDocument();
  });
});
