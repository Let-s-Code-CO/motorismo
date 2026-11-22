import { useCallback } from 'react';

/** The gap between a banner and the floating notices above it. */
const GAP_PX = 8;

const heights = new Map<object, number>();

const publish = () => {
  const tallest = Math.max(0, ...heights.values());
  const style = document.documentElement.style;
  if (tallest > 0) style.setProperty('--bottom-banners', `${tallest + GAP_PX}px`);
  else style.removeProperty('--bottom-banners');
};

/**
 * A banner at the bottom of the screen (install, new version: spec 006) makes room for the floating
 * notices (spec 013, CA-02): `--bottom-banners` holds its height plus a gap, and the notices rise
 * above it instead of covering it. With two banners, the tallest counts; it follows the banner's
 * size while it is shown. Returns the banner's `ref` (a callback: banners appear and go away).
 */
const useBottomBanner = () =>
  useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const key = {};
    const measure = () => {
      heights.set(key, element.offsetHeight);
      publish();
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      heights.delete(key);
      publish();
    };
  }, []);

export default useBottomBanner;
