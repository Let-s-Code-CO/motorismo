import { heroui } from '@heroui/react';

/**
 * Visual system (spec 003): neutral zinc base and a near-black primary, like the brand logo.
 * Semantic colours (success, warning, danger) are reserved for states.
 */
export default heroui({
  layout: {
    radius: { small: '8px', medium: '12px', large: '16px' },
    borderWidth: { small: '1px', medium: '1px', large: '2px' },
  },
  themes: {
    light: {
      colors: {
        background: '#fafafa',
        foreground: '#18181b',
        primary: { DEFAULT: '#18181b', foreground: '#ffffff' },
        focus: '#3f3f46',
      },
    },
  },
});
