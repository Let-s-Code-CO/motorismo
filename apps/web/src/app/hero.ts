import { colors, heroui } from '@heroui/react';
import { semanticColors } from '@heroui/theme';

/**
 * Visual system (spec 003): neutral zinc base and a near-black primary, like the brand logo.
 * Semantic colours (success, warning, danger) are reserved for states.
 *
 * `foreground` keeps HeroUI's zinc scale: its components paint placeholders with
 * `foreground-500` and helper text with `foreground-400`, and a plain colour string would drop
 * the scale (the placeholder then inherits the text colour and looks filled in). Step 400 is
 * raised to zinc-500 so helper text keeps AA contrast (4.6:1 on #fafafa; zinc-400 is 2.5:1).
 *
 * `danger` keeps HeroUI's red scale with step 600 as its DEFAULT: field errors (`text-danger`)
 * and solid danger buttons then reach AA contrast on white (6.1:1; red-500 is below 4.5:1). Found by
 * the accessibility audit of the spec 007 forms with their errors showing.
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
        danger: { ...colors.red, DEFAULT: colors.red[600], foreground: '#ffffff' },
        focus: '#3f3f46',
      },
    },
    // Spec 010: the same monochrome system on a near-black base. Text and secondary text are
    // lighter steps of zinc so they keep AA contrast on the dark background (zinc-400 on #09090b is
    // 7.8:1); the primary turns near-white. The semantic colours keep HeroUI's dark scales (flat
    // chips and alerts read well on dark), which are inverted: a solid destructive button there is
    // `dark:bg-danger-300`, the same red as `bg-danger-600` in light, white text at 6.1:1.
    dark: {
      colors: {
        background: '#09090b',
        foreground: {
          50: colors.zinc[900],
          100: colors.zinc[800],
          200: colors.zinc[700],
          300: colors.zinc[600],
          400: colors.zinc[400],
          500: colors.zinc[400],
          600: colors.zinc[300],
          700: colors.zinc[200],
          800: colors.zinc[100],
          900: colors.zinc[50],
          DEFAULT: '#fafafa',
        },
        default: {
          50: colors.zinc[900],
          100: colors.zinc[800],
          200: colors.zinc[700],
          300: colors.zinc[600],
          400: colors.zinc[500],
          500: colors.zinc[400],
          600: colors.zinc[300],
          700: colors.zinc[200],
          800: colors.zinc[100],
          900: colors.zinc[50],
          DEFAULT: colors.zinc[700],
          foreground: '#fafafa',
        },
        content1: colors.zinc[900],
        content2: colors.zinc[800],
        content3: colors.zinc[700],
        content4: colors.zinc[600],
        divider: 'rgba(255, 255, 255, 0.12)',
        primary: { DEFAULT: '#fafafa', foreground: '#18181b' },
        // One step lighter than HeroUI's dark DEFAULT (#f31260, 4.27:1 on a card): field errors
        // reach AA on the cards (#f54180 on #18181b, about 5:1). Found by the dark audit.
        danger: { ...(semanticColors.dark.danger as Record<string, string>), DEFAULT: '#f54180' },
        focus: colors.zinc[300],
      },
    },
  },
});
