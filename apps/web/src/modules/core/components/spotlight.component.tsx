'use client';

import { useEffect } from 'react';

/**
 * The light that follows the cursor over the cards (spec 019, CA-05). One passive listener for the
 * whole document: on a pointer move over a card (`.bg-content1`) it writes the position relative to
 * that card as `--mx` and `--my`, and the stylesheet draws the light there. It draws nothing itself.
 */
const Spotlight = () => {
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.<HTMLElement>('.bg-content1');
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - box.left}px`);
      card.style.setProperty('--my', `${event.clientY - box.top}px`);
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, []);

  return null;
};

export default Spotlight;
