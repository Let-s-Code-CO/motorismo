/**
 * The notices of what the person just did (spec 013): a confirmation or an error, shown by the
 * floating region of the root layout. Any screen calls `notify` after its action; the store lives
 * in memory, so a reload starts empty and nothing repeats (CA-05).
 */

export type ToastTone = 'success' | 'danger';

export type Toast = { id: string; tone: ToastTone; text: string };

type NotifyInput = {
  tone: ToastTone;
  text: string;
  /** The path of the screen the action leads to: the notice waits until it is shown (CA-05). */
  after?: string;
};

/** At most 3 notices at a time; the fourth pushes the oldest out (CA-06). */
export const MAX_TOASTS = 3;

let toasts: readonly Toast[] = [];
let pending: { path: string; toast: Toast }[] = [];
/** The path of the screen shown, as the region last reported it. */
let here: string | null = null;
let lastId = 0;
const listeners = new Set<() => void>();

const publish = (next: readonly Toast[]) => {
  toasts = next.slice(-MAX_TOASTS);
  for (const listener of listeners) listener();
};

export const notify = ({ tone, text, after }: NotifyInput) => {
  lastId += 1;
  const toast = { id: `toast-${lastId}`, tone, text };
  // A notice for the screen already shown shows at once: its path will not change again.
  if (after && after !== here) {
    pending = [...pending, { path: after, toast }];
    return;
  }
  publish([...toasts, toast]);
};

export const dismiss = (id: string) => {
  if (!toasts.some((toast) => toast.id === id)) return;
  publish(toasts.filter((toast) => toast.id !== id));
};

/** The region calls it on every new screen: the notices waiting for it show now, once. */
export const arrive = (path: string) => {
  here = path;
  const due = pending.filter((item) => item.path === path);
  if (due.length === 0) return;
  pending = pending.filter((item) => item.path !== path);
  publish([...toasts, ...due.map((item) => item.toast)]);
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getSnapshot = () => toasts;

const NONE: readonly Toast[] = [];
/** On the server there are never notices: they only come from what the person does. */
export const getServerSnapshot = () => NONE;

/** Tests only: start from nothing. */
export const resetToasts = () => {
  toasts = [];
  pending = [];
  here = null;
  for (const listener of listeners) listener();
};
