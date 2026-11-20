/**
 * ConnectionGate — without network, the app warns and lets nobody operate (spec 006, HU-02).
 *
 * Guards:
 * - CA-06: when the connection drops, a fixed «Sin conexión» notice shows and is announced to
 *   screen readers (an alert), saying nothing can be done until the network is back.
 * - CA-07: while offline the whole app is inert (no clicks, no typing, no focus), and so is any
 *   dialog opened after the drop: dialogs hang from <body>, outside the page, so the gate marks
 *   every child of <body> but its own notice.
 * - CA-08: when the network comes back the notice goes, the app works again and what was typed
 *   is still there (inert hides nothing and unmounts nothing).
 * - RN-02 / spec assumption: what was on screen stays visible to read; only operating is blocked.
 * - The notice is announced even over an open dialog (which hides everything outside it from
 *   screen readers).
 * - It only lifts the `inert` it set: one that something else put stays.
 */
import { Modal, ModalBody, ModalContent } from '@heroui/react';
import { act, fireEvent, screen } from '@testing-library/react';

import ConnectionGate from '@web/modules/pwa/components/connection-gate.component';

import { renderWithProviders } from '@tests/test-utils/render';

const NOTICE = 'Sin conexión. No puedes guardar ni consultar nada hasta que vuelva la red.';

const goOffline = () => act(() => void window.dispatchEvent(new Event('offline')));
const goOnline = () => act(() => void window.dispatchEvent(new Event('online')));

const renderApp = () =>
  renderWithProviders(
    <>
      <label>
        Nombre completo
        <input />
      </label>
      <ConnectionGate />
    </>
  );

describe('ConnectionGate', () => {
  afterEach(() => {
    goOnline();
    document.body.querySelectorAll('[data-test-portal]').forEach((el) => el.remove());
  });

  it('shows nothing and blocks nothing while there is network', () => {
    const { container } = renderApp();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container).not.toHaveAttribute('inert');
  });

  it('announces «Sin conexión» when the connection drops (CA-06)', () => {
    renderApp();

    goOffline();

    expect(screen.getByRole('alert')).toHaveTextContent(NOTICE);
  });

  it('makes the whole app inert while offline, but not its own notice (CA-07)', () => {
    const { container } = renderApp();

    goOffline();

    expect(container).toHaveAttribute('inert');
    expect(screen.getByRole('alert').closest('[inert]')).toBeNull();
    // Still on screen to read (inert hides nothing).
    expect(container).toContainElement(document.querySelector('input'));
  });

  it('also makes inert a dialog opened after the connection dropped (CA-07)', async () => {
    renderApp();
    goOffline();

    const dialog = document.createElement('div');
    dialog.dataset.testPortal = '';
    document.body.append(dialog);
    // The MutationObserver runs as a microtask after the DOM change.
    await act(async () => {});

    expect(dialog).toHaveAttribute('inert');
  });

  it('announces «Sin conexión» over a dialog opened on the page, as in the app (CA-06)', async () => {
    const page = (isOpen: boolean) => (
      <>
        <ConnectionGate />
        <Modal isOpen={isOpen}>
          <ModalContent>
            <ModalBody>Nuevo cliente</ModalBody>
          </ModalContent>
        </Modal>
      </>
    );
    const { rerender } = renderWithProviders(page(false));
    rerender(page(true));
    // Let the dialog hide what is outside it (its observers run after the DOM changes).
    await act(async () => {});

    goOffline();

    expect(screen.getByRole('alert')).toHaveTextContent(NOTICE);
  });

  it('lifts the block and the notice when the network is back, keeping what was typed (CA-08)', () => {
    const { container } = renderApp();
    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'Camila Cliente' },
    });

    goOffline();
    goOnline();

    expect(container).not.toHaveAttribute('inert');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Camila Cliente');
  });

  it('only lifts the inert it set: an element already inert stays so', () => {
    renderApp();
    const alreadyInert = document.createElement('div');
    alreadyInert.dataset.testPortal = '';
    alreadyInert.setAttribute('inert', '');
    document.body.append(alreadyInert);

    goOffline();
    goOnline();

    expect(alreadyInert).toHaveAttribute('inert');
  });
});
