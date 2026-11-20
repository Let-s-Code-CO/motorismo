'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTranslations } from 'next-intl';

import { Alert } from '@heroui/react';

import useConnection from '@web/modules/pwa/hooks/connection.hook';

/**
 * Without network, nobody operates (spec 006, HU-02). While offline, every child of <body> but this
 * notice is `inert`: no clicks, typing or focus, also in dialogs opened later, which hang from
 * <body> outside the page (CA-07). Nothing unmounts, so what is on screen stays visible and what
 * was typed is kept for when the network is back (CA-08). The notice is an alert, announced to
 * screen readers (CA-06); inert also hides the page from them meanwhile, and the notice says why.
 */
const ConnectionGate = () => {
  const t = useTranslations('pwa.offline');
  const offline = useConnection() === 'offline';
  // Its own child of <body>, so it can stay usable while everything else is inert. Marked as a
  // top layer: an open dialog hides everything outside it from screen readers (aria-hidden) but
  // that, so the notice is still announced over a dialog. None on the server.
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null;
    const element = document.createElement('div');
    element.dataset.connectionGate = '';
    element.dataset.reactAriaTopLayer = 'true';
    return element;
  });

  useEffect(() => {
    if (!host) return;
    document.body.append(host);
    return () => host.remove();
  }, [host]);

  useEffect(() => {
    if (!offline || !host) return;
    // Only what this gate made inert is released later: an element already inert stays so.
    const madeInert = new Set<Element>();
    const block = () => {
      for (const element of Array.from(document.body.children)) {
        if (element === host || element.hasAttribute('inert')) continue;
        element.setAttribute('inert', '');
        madeInert.add(element);
      }
    };
    block();
    const observer = new MutationObserver(block);
    observer.observe(document.body, { childList: true });
    return () => {
      observer.disconnect();
      madeInert.forEach((element) => element.removeAttribute('inert'));
    };
  }, [offline, host]);

  if (!offline || !host) return null;

  return createPortal(
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl shadow-large">
      <Alert color="warning" variant="solid" title={t('banner')} />
    </div>,
    host
  );
};

export default ConnectionGate;
