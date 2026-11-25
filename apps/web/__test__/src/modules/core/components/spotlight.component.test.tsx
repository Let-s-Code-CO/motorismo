/**
 * Spotlight — the light that follows the cursor over the cards (spec 019, CA-05).
 *
 * It only tells the CSS where the pointer is: on a move over a card (`.bg-content1`), it writes the
 * position relative to that card as `--mx` and `--my`; the stylesheet draws the light there. Over
 * anything else it writes nothing, and once gone it stops listening.
 */
import { fireEvent, render } from '@testing-library/react';

import Spotlight from '@web/modules/core/components/spotlight.component';

const card = () => {
  const element = document.createElement('div');
  element.className = 'bg-content1';
  element.innerHTML = '<span>Agenda</span>';
  element.getBoundingClientRect = () =>
    ({
      left: 100,
      top: 40,
      width: 200,
      height: 120,
      right: 300,
      bottom: 160,
      x: 100,
      y: 40,
    }) as DOMRect;
  document.body.append(element);
  return element;
};

describe('Spotlight', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('writes where the pointer is over a card, relative to it: (150 − 100, 90 − 40) = (50 px, 50 px)', () => {
    render(<Spotlight />);
    const target = card();

    fireEvent(
      target.firstChild!,
      new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 90 })
    );

    expect(target.style.getPropertyValue('--mx')).toBe('50px');
    expect(target.style.getPropertyValue('--my')).toBe('50px');
  });

  it('writes nothing, on the cards or elsewhere, when the pointer moves over something that is not a card', () => {
    render(<Spotlight />);
    const target = card();
    const other = document.createElement('p');
    document.body.append(other);

    fireEvent(other, new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 90 }));

    expect(target.style.getPropertyValue('--mx')).toBe('');
    expect(other.style.getPropertyValue('--mx')).toBe('');
  });

  it('stops listening once it is gone', () => {
    const { unmount } = render(<Spotlight />);
    const target = card();
    unmount();

    fireEvent(target, new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 90 }));

    expect(target.style.getPropertyValue('--mx')).toBe('');
  });
});
