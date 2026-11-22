/**
 * toast.lib — the notices of what the person just did, anywhere in the app (spec 013).
 *
 * The screens call `notify` after saving; the floating region shows what this store holds.
 *
 * Guards:
 * - RF-01: a notice has a tone (a confirmation or an error) and its text; `dismiss` takes it away.
 * - CA-06: at most 3 at a time: the fourth one pushes the oldest out; the newest is last.
 * - CA-05: a notice for the screen the action leads to (`after`) waits until that screen is
 *   reached, and shows once: it lives only in memory, so reloading or going back never repeats it.
 *   If that screen is already the one shown (the address only loses `?edit=1`), it shows at once.
 */
import {
  arrive,
  dismiss,
  getSnapshot,
  notify,
  resetToasts,
  subscribe,
} from '@web/modules/core/lib/toast.lib';

const texts = () => getSnapshot().map((toast) => toast.text);

describe('toast.lib', () => {
  afterEach(resetToasts);

  it('adds a notice with its tone and text, and takes it away (RF-01)', () => {
    notify({ tone: 'success', text: 'Configuración guardada.' });

    const [toast] = getSnapshot();
    expect(toast).toMatchObject({ tone: 'success', text: 'Configuración guardada.' });

    dismiss(toast!.id);
    expect(getSnapshot()).toEqual([]);
  });

  it('keeps the newest last, and at most 3: the fourth pushes the oldest out (CA-06)', () => {
    for (const text of ['Uno', 'Dos', 'Tres', 'Cuatro']) notify({ tone: 'success', text });

    expect(texts()).toEqual(['Dos', 'Tres', 'Cuatro']);
  });

  it('gives every notice its own id, so the same text twice shows twice', () => {
    notify({ tone: 'success', text: 'Guardado.' });
    notify({ tone: 'success', text: 'Guardado.' });

    const [first, second] = getSnapshot();
    expect(first!.id).not.toBe(second!.id);
  });

  it('holds a notice for the screen the action leads to until that screen is reached, once (CA-05)', () => {
    notify({ tone: 'success', text: 'Reserva guardada.', after: '/agenda/r1' });
    expect(texts()).toEqual([]);

    arrive('/agenda');
    expect(texts()).toEqual([]);

    arrive('/agenda/r1');
    expect(texts()).toEqual(['Reserva guardada.']);

    // Coming to that screen again (going back, another visit) does not repeat it.
    resetVisible();
    arrive('/agenda/r1');
    expect(texts()).toEqual([]);
  });

  it('shows at once a notice for the screen already shown (changing a reservation stays on it) (CA-05)', () => {
    arrive('/agenda/r1');

    notify({ tone: 'success', text: 'Reserva guardada.', after: '/agenda/r1' });

    expect(texts()).toEqual(['Reserva guardada.']);
  });

  it('tells the region whenever the notices change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    notify({ tone: 'danger', text: 'No se pudo guardar.' });
    dismiss(getSnapshot()[0]!.id);
    unsubscribe();
    notify({ tone: 'success', text: 'Otra.' });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('hands out the same list until something changes, then a new one (React compares them)', () => {
    notify({ tone: 'success', text: 'Guardado.' });
    const before = getSnapshot();
    expect(getSnapshot()).toBe(before);

    notify({ tone: 'success', text: 'Otra.' });
    expect(getSnapshot()).not.toBe(before);
  });
});

/** Clears what is on screen, keeping nothing pending: as if the person closed every notice. */
const resetVisible = () => {
  for (const toast of getSnapshot()) dismiss(toast.id);
};
