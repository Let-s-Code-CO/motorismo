import { colors, heroui } from '@heroui/react';

/**
 * Visual system (spec 003): neutral zinc base and a near-black primary, like the brand logo.
 * Semantic colours (success, warning, danger) are reserved for states.
 *
 * `foreground` keeps HeroUI's zinc scale: its components paint placeholders with
 * `foreground-500` and helper text with `foreground-400`, and a plain colour string would drop
 * the scale (the placeholder then inherits the text colour and looks filled in). Step 400 is
 * raised to zinc-500 so helper text keeps AA contrast (4.6:1 on #fafafa; zinc-400 is 2.5:1).
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
        foreground: { ...colors.zinc, 400: colors.zinc[500], DEFAULT: '#18181b' },
        primary: { DEFAULT: '#18181b', foreground: '#ffffff' },
        focus: '#3f3f46',
      },
    },
  },
});
