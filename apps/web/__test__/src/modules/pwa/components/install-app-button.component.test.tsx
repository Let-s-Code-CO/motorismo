/**
 * InstallAppButton — «Instalar app» next to the account in the header (spec 006, HU-03).
 *
 * Guards:
 * - CA-12: where the browser can install the app itself (Chrome, Edge, Android), the button
 *   shows and asks the browser to install; the browser's own offer is held back until then.
 * - CA-13: on an iPhone or iPad, the button shows the steps to add the app to the home screen.
 * - CA-14: there is no button once the app is installed (opened from its icon, or just installed)
 *   or where the browser cannot install it.
 *
 * The browser's offer (`beforeinstallprompt`) is kept by a module that listens from the first
 * script, so each test loads a fresh copy of it.
 */
import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '@tests/test-utils/render';

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const setDevice = ({ userAgent = UA_DESKTOP, touch = 0, standalone = false } = {}) => {
  // jsdom has no maxTouchPoints: both are set on the navigator itself and removed after each test.
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: touch });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

/** The browser's install offer, as Chrome fires it. */
const browserOffer = () => {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  act(() => void window.dispatchEvent(event));
  return event;
};

const renderButton = async () => {
  vi.resetModules();
  const { default: InstallAppButton } =
    await import('@web/modules/pwa/components/install-app-button.component');
  return renderWithProviders(<InstallAppButton />);
};

describe('InstallAppButton', () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'userAgent');
    Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
    vi.unstubAllGlobals();
  });

  it('offers «Instalar app» once the browser can install, and asks it to (CA-12)', async () => {
    setDevice();
    await renderButton();
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();

    const offer = browserOffer();
    // The browser's own banner is held back: the app offers it from its button.
    expect(offer.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));

    expect(offer.prompt).toHaveBeenCalledTimes(1);
  });

  it('shows the steps to add the app to the home screen on an iPhone (CA-13)', async () => {
    setDevice({ userAgent: UA_IPHONE, touch: 5 });
    await renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Instalar Motorismo en tu iPhone o iPad',
    });
    expect(dialog).toHaveTextContent('Toca el botón Compartir, en la barra de Safari.');
    expect(dialog).toHaveTextContent('Elige «Agregar a inicio».');
    expect(dialog).toHaveTextContent(
      'Toca «Agregar»: Motorismo aparecerá con su ícono en tu pantalla de inicio.'
    );
  });

  it('offers nothing when the app was opened from its icon (CA-14)', async () => {
    setDevice({ userAgent: UA_IPHONE, touch: 5, standalone: true });
    await renderButton();
    browserOffer();

    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();
  });

  it('offers nothing where the browser cannot install the app (CA-14)', async () => {
    setDevice();
    await renderButton();

    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();
  });

  it('stops offering once the app is installed (CA-14)', async () => {
    setDevice();
    await renderButton();
    browserOffer();
    expect(screen.getByRole('button', { name: 'Instalar app' })).toBeVisible();

    act(() => void window.dispatchEvent(new Event('appinstalled')));

    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();
  });
});
