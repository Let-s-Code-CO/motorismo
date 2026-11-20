/**
 * ThemeMenu — the desktop's own theme menu in the header (spec 010, CA-10): its icon is the chosen
 * theme, and it opens the three choices.
 *
 * Guards:
 * - CA-10: the button shows the chosen theme's icon and says it («Tema: Oscuro»); it opens Claro,
 *   Oscuro and Sistema, each with its icon, the current one marked; choosing changes the theme.
 * - CA-13: the chosen one is announced (`aria-checked`). Using it with the keyboard alone is
 *   checked in a real browser (e2e/theme.spec.ts): jsdom does not drive React Aria's keyboard.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import ThemeMenu from '@web/modules/theme/components/theme-menu.component';
import type { ThemeChoice } from '@web/modules/theme/constants/theme.constants';
import { ThemeProvider } from '@web/modules/theme/providers/theme.provider';

import { renderWithProviders } from '@tests/test-utils/render';

const renderMenu = (initialChoice: ThemeChoice) =>
  renderWithProviders(
    <ThemeProvider initialChoice={initialChoice}>
      <ThemeMenu />
    </ThemeProvider>
  );

/** The drawing shown (sun, moon or screen), not just the choice it stands for. */
const DRAWINGS = {
  'lucide-sun': 'light',
  'lucide-moon': 'dark',
  'lucide-monitor': 'system',
} as const;
const icon = (element: HTMLElement) => {
  const svg = element.querySelector('svg');
  const drawing = Object.keys(DRAWINGS).find((name) => svg?.classList.contains(name));
  return drawing ? DRAWINGS[drawing as keyof typeof DRAWINGS] : undefined;
};

describe('ThemeMenu', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows and says the chosen theme (CA-10)', () => {
    const { unmount } = renderMenu('dark');
    expect(icon(screen.getByRole('button', { name: 'Tema: Oscuro' }))).toBe('dark');
    unmount();

    renderMenu('system');
    expect(icon(screen.getByRole('button', { name: 'Tema: Sistema' }))).toBe('system');
  });

  it('opens the three choices with their icons, the current one marked (CA-10, CA-13)', async () => {
    renderMenu('system');

    fireEvent.click(screen.getByRole('button', { name: 'Tema: Sistema' }));
    const menu = await screen.findByRole('menu', { name: /^Tema/ });
    const options = within(menu).getAllByRole('menuitemradio');

    expect(options.map((option) => option.textContent)).toEqual(['Claro', 'Oscuro', 'Sistema']);
    expect(options.map(icon)).toEqual(['light', 'dark', 'system']);
    expect(options.map((option) => option.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });

  it('changes the theme when one is chosen (CA-10)', async () => {
    renderMenu('system');

    fireEvent.click(screen.getByRole('button', { name: 'Tema: Sistema' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Oscuro' }));

    expect(document.documentElement).toHaveClass('dark');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tema: Oscuro' })).toBeInTheDocument()
    );
  });
});
