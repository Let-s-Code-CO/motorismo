/**
 * NavLinks — main menu (spec 003, CA-06; spec 002, CA-07; spec 004, CA-08 and RF-04; spec 007,
 * CA-19).
 *
 * Guards: the section the user is in is marked as current (aria-current="page"); a customer sees
 * their own Inicio, Mis reservas, Historial and Mi perfil (spec 014).
 * Spec 018 (HU-05): an admin sees Inicio, Órdenes, Agenda and Clientes in the bar and the rest under
 * «Administración» (Servicios, Empleados, Reportes, Habeas data, Marcas y líneas, Usuarios), which
 * is marked while one of them is open; an operator has no «Administración» and sees Servicios and
 * Empleados in the bar (CA-21). What does not fit goes, from the end, to «Más ▾» («Administración»
 * as a section inside it); with room for everything there is no «Más» (CA-22, CA-25), and a change
 * of width moves entries in and out without reloading (CA-24). Choosing a section of a menu goes
 * there (CA-23).
 *
 * Widths are simulated (jsdom has no layout): each text measures 10 px per letter and the bar has the
 * room each test sets; ResizeObserver is a fake the test triggers.
 */
import { usePathname } from 'next/navigation';

import { act, fireEvent, screen, within } from '@testing-library/react';

import NavLinks from '@web/modules/auth/components/molecules/nav-links.component';

import { renderWithProviders } from '@tests/test-utils/render';

const push = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: vi.fn(), useRouter: () => ({ push }) }));

// Layout simulated: 10 px per letter, and the room the test gives the bar.
let room = 1000;
const resizeCallbacks: ((entries: ResizeObserverEntry[]) => void)[] = [];
beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const width = (this.textContent ?? '').length * 10;
    return {
      width,
      height: 20,
      top: 0,
      left: 0,
      right: width,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => room);
  // Only what is observed hears a resize, as with the real one.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: (entries: ResizeObserverEntry[]) => void) {}
      observe() {
        resizeCallbacks.push(this.callback);
      }
      unobserve() {}
      disconnect() {}
    }
  );
});
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The window changes size: the bar has `width` px now. */
const resizeTo = (width: number) => {
  room = width;
  act(() => resizeCallbacks.forEach((callback) => callback([])));
};

/** The bar itself (the hidden copy that measures it is out of the accessibility tree). */
const bar = () => screen.getByRole('list');
const linkNames = () =>
  within(bar())
    .queryAllByRole('link')
    .map((link) => link.textContent);
const openMenu = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.findByRole('menu', { name });
};
const itemNames = async (name: string) =>
  within(await openMenu(name))
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

describe('NavLinks', () => {
  beforeEach(() => {
    room = 1000;
    resizeCallbacks.length = 0;
  });
  afterEach(() => {
    push.mockClear();
  });

  it('marks the current section (CA-06)', () => {
    vi.mocked(usePathname).mockReturnValue('/orders');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(screen.getByRole('link', { name: 'Órdenes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('shows an admin Inicio, Órdenes, Agenda and Clientes, and the rest under «Administración» (spec 018, CA-21)', async () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(linkNames()).toEqual(['Inicio', 'Órdenes', 'Agenda', 'Clientes']);
    expect(screen.getByRole('button', { name: 'Administración' })).not.toHaveAttribute(
      'data-current'
    );
    expect(await itemNames('Administración')).toEqual([
      'Servicios',
      'Empleados',
      'Reportes',
      'Habeas data',
      'Marcas y líneas',
      'Usuarios',
    ]);
  });

  it('marks «Administración» while one of its sections is open (CA-23)', () => {
    vi.mocked(usePathname).mockReturnValue('/services');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(screen.getByRole('button', { name: 'Administración' })).toHaveAttribute(
      'data-current',
      'true'
    );
  });

  it('goes to the section chosen under «Administración» (CA-23)', async () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    fireEvent.click(
      within(await openMenu('Administración')).getByRole('menuitem', { name: 'Marcas y líneas' })
    );

    expect(push).toHaveBeenCalledWith('/admin/vehicle-catalog');
  });

  it('shows an operator Servicios and Empleados in the bar, without «Administración» (CA-07; spec 018, CA-21)', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="operator" />);

    expect(linkNames()).toEqual([
      'Inicio',
      'Órdenes',
      'Agenda',
      'Clientes',
      'Servicios',
      'Empleados',
    ]);
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('has no «Más» when everything fits (CA-22)', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('moves what does not fit, from the end, to «Más»: «Administración» goes inside as a section (CA-25)', async () => {
    // Inicio 60 + Órdenes 70 + Agenda 60 + Clientes 80 = 270, and «Más» 30: 300 px hold them.
    room = 300;
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(linkNames()).toEqual(['Inicio', 'Órdenes', 'Agenda', 'Clientes']);
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    const more = await openMenu('Más');
    expect(within(more).getByRole('group', { name: 'Administración' })).toBeInTheDocument();
    expect(
      within(more)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Servicios', 'Empleados', 'Reportes', 'Habeas data', 'Marcas y líneas', 'Usuarios']);
  });

  it('leaves the links of an operator from the end too: 220 px hold Inicio, Órdenes and «Más» (CA-25)', async () => {
    // Inicio 60 + Órdenes 70 = 130, + Agenda 60 = 190, + «Más» 30 = 220.
    room = 220;
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="operator" />);

    expect(linkNames()).toEqual(['Inicio', 'Órdenes', 'Agenda']);
    expect(await itemNames('Más')).toEqual(['Clientes', 'Servicios', 'Empleados']);
  });

  it('marks «Más» when the current section is inside it, and goes to what is chosen there (CA-23)', async () => {
    room = 220;
    vi.mocked(usePathname).mockReturnValue('/employees');
    renderWithProviders(<NavLinks audience="operator" />);

    expect(screen.getByRole('button', { name: 'Más' })).toHaveAttribute('data-current', 'true');
    fireEvent.click(within(await openMenu('Más')).getByRole('menuitem', { name: 'Servicios' }));
    expect(push).toHaveBeenCalledWith('/services');
  });

  it('moves entries to «Más» and back when the window changes size, without reloading (CA-24)', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);
    expect(screen.getByRole('button', { name: 'Administración' })).toBeInTheDocument();

    resizeTo(300);
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más' })).toBeInTheDocument();

    resizeTo(1000);
    expect(screen.getByRole('button', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('shows a customer «Inicio», «Mis reservas», «Historial» and «Mi perfil» (spec 004, CA-08; spec 014)', () => {
    vi.mocked(usePathname).mockReturnValue('/profile');
    renderWithProviders(<NavLinks audience="customer" />);

    expect(linkNames()).toEqual(['Inicio', 'Mis reservas', 'Historial', 'Mi perfil']);
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/my');
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks only «Historial» on the customer’s history: «Inicio» is not a prefix of their sections (spec 014)', () => {
    vi.mocked(usePathname).mockReturnValue('/my/history');
    renderWithProviders(<NavLinks audience="customer" />);

    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });
});
