import type { ReactNode } from 'react';

/**
 * Wraps every signed-in screen and mounts again on each navigation (spec 011, HU-03): its content
 * enters with a short fade, rising a few pixels (CA-09). The header and the menu belong to the
 * layout, outside: they do not move. No motion at all with «reducir movimiento» (CA-10).
 */
const Template = ({ children }: { children: ReactNode }) => (
  <div data-page className="flex flex-1 flex-col motion-safe:animate-page-in">
    {children}
  </div>
);

export default Template;
