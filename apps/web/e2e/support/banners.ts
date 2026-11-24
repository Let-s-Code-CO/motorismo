import type { Locator } from '@playwright/test';

/**
 * Whether a floating banner hides what passes under it: from its text up to the banner itself (the
 * element that floats, `sticky` or `fixed`), some box has a fully opaque background. A translucent
 * one lets the page be read through it (seen in dark mode, backlog 2026-11-21).
 */
export const floatsOpaque = (text: Locator) =>
  text.evaluate((node) => {
    const alphaOf = (color: string) => {
      if (color === 'transparent') return 0;
      const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
      return parts.length === 4 ? parts[3]! : 1;
    };
    for (let element: Element | null = node; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (alphaOf(style.backgroundColor) === 1) return true;
      if (style.position === 'sticky' || style.position === 'fixed') return false;
    }
    return false;
  });
