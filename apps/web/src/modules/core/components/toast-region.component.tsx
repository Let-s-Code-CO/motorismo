'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { Button } from '@heroui/react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

import {
  type Toast,
  arrive,
  dismiss,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from '@web/modules/core/lib/toast.lib';

/** A confirmation closes by itself after 5 s; an error never does (spec 013, RN-01). */
const CONFIRMATION_MS = 5000;

const ToastItem = ({ toast }: { toast: Toast }) => {
  const t = useTranslations('core.toast');
  const [pointer, setPointer] = useState(false);
  const [focus, setFocus] = useState(false);
  // The time it still has: pointing at it or focusing it stops the clock (CA-03).
  const left = useRef(CONFIRMATION_MS);
  const paused = pointer || focus;

  useEffect(() => {
    if (toast.tone !== 'success' || paused) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss(toast.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [toast.id, toast.tone, paused]);

  const Icon = toast.tone === 'success' ? CircleCheck : CircleAlert;

  return (
    <div
      data-toast={toast.tone}
      onPointerEnter={() => setPointer(true)}
      onPointerLeave={() => setPointer(false)}
      onFocus={() => setFocus(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocus(false);
      }}
      className={`pointer-events-auto flex items-start gap-3 rounded-large border bg-content1 p-3 pl-4 text-sm shadow-medium motion-safe:animate-toast-in ${
        toast.tone === 'success'
          ? 'border-success-300 dark:border-success-200'
          : 'border-danger-300 dark:border-danger-200'
      }`}
    >
      <Icon
        aria-hidden
        className={`mt-0.5 size-5 shrink-0 ${
          toast.tone === 'success' ? 'text-success-600 dark:text-success' : 'text-danger'
        }`}
      />
      <p className="min-w-0 flex-1 self-center text-foreground">{toast.text}</p>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        radius="full"
        aria-label={t('close')}
        className="-my-1 -mr-1 shrink-0"
        onPress={() => dismiss(toast.id)}
      >
        <X aria-hidden className="size-4" />
      </Button>
    </div>
  );
};

/**
 * The notices on screen and their live regions, without following the route (the tests render it
 * alone).
 */
export const ToastStack = () => {
  const t = useTranslations('core.toast');
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const list = (tone: Toast['tone']) =>
    toasts
      .filter((toast) => toast.tone === tone)
      .map((toast) => <ToastItem key={toast.id} toast={toast} />);

  return (
    <section
      aria-label={t('region')}
      data-react-aria-top-layer
      className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+var(--bottom-banners,0px))] z-[60] flex flex-col md:inset-x-auto md:right-6 md:bottom-[calc(1.5rem+var(--bottom-banners,0px))] md:w-96"
    >
      <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
        {list('success')}
      </div>
      {/* Only spaced when it holds something: empty, it must not lift the confirmations. */}
      <div aria-live="assertive" aria-atomic="false" className="flex flex-col gap-2 not-empty:mt-2">
        {list('danger')}
      </div>
    </section>
  );
};

/**
 * The floating notices of what the person just did (spec 013): at the bottom right from a tablet
 * on, at the bottom and full width on a phone (CA-02), over everything, dialogs included, and
 * above the banners of spec 006 (`--bottom-banners`, see `useBottomBanner`). Mounted
 * once in the root layout, so a notice survives the navigation it causes; one left for another
 * screen shows when that screen is reached (CA-05).
 *
 * Two live regions, always in the page so they announce what arrives (CA-10): confirmations
 * politely, errors at once. Plain `aria-live`, without the `status`/`alert` roles, so the empty
 * regions are not taken for a screen's own status or alert. `data-react-aria-top-layer` keeps them readable while a dialog hides
 * the rest of the page from screen readers.
 */
const ToastRegion = () => {
  const pathname = usePathname();

  useEffect(() => {
    arrive(pathname);
  }, [pathname]);

  return <ToastStack />;
};

export default ToastRegion;
