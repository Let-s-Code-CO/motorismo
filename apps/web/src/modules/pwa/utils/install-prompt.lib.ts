import { isIos, isStandalone } from '@web/modules/pwa/utils/platform.utils';

/** The event Chrome, Edge and Android fire when the app can be installed (not in the DOM types). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** How the app can be installed here (spec 006, HU-03): by the browser, by hand on iOS, or not. */
export type InstallOption = 'prompt' | 'ios' | null;

let offer: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Listens from the first script (imported by AppProvider): the browser may make its offer before
 * the header mounts. The browser's own banner is held back; «Instalar app» shows it (CA-12).
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    offer = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    installed = true;
    notify();
  });
}

export const subscribeInstallOption = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getInstallOption = (): InstallOption => {
  if (installed || isStandalone()) return null;
  if (offer) return 'prompt';
  return isIos() ? 'ios' : null;
};

/** On the server nothing can be installed: the client decides after hydration. */
export const getServerInstallOption = (): InstallOption => null;

/** Shows the browser's install dialog; the offer can only be used once. */
export const promptInstall = async () => {
  if (!offer) return;
  const current = offer;
  await current.prompt();
  await current.userChoice;
  if (offer === current) offer = null;
  notify();
};
