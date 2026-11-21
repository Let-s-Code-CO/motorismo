import type { ReactNode } from 'react';

/**
 * The sign-in pages appear with a fade (spec 011, CA-13): after signing out, the way back in does
 * not just pop up. No fade with «reducir movimiento» (CA-14).
 */
const Template = ({ children }: { children: ReactNode }) => (
  <div data-page className="motion-safe:animate-fade-in">
    {children}
  </div>
);

export default Template;
