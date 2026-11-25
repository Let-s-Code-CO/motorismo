import { colors, heroui } from '@heroui/react';
import { semanticColors } from '@heroui/theme';

/**
 * Visual system (spec 003): neutral zinc base and a near-black primary, like the brand logo.
 * Semantic colours (success, warning, danger) are reserved for states.
 *
 * `foreground` keeps HeroUI's zinc scale: its components paint placeholders with
 * `foreground-500` and helper text with `foreground-400`, and a plain colour string would drop
 * the scale (the placeholder then inherits the text colour and looks filled in). Step 400 is
 * raised so helper text keeps AA contrast (zinc-400 is 2.5:1); see `SECONDARY_ON_SHOWROOM`.
 *
 * `danger` keeps HeroUI's red scale with step 600 as its DEFAULT: field errors (`text-danger`)
 * and solid danger buttons then reach AA contrast on white (6.1:1; red-500 is below 4.5:1). Found by
 * the accessibility audit of the spec 007 forms with their errors showing.
 *
 * Spec 019 (automotive premium, silver accent): the accent is steel with white ink in light (silver
 * does not stand out on a light background) and silver with dark ink in dark; a showroom grey and a
 * near black as backgrounds; larger radii; cards with a lit top edge and a deep, soft shadow.
 */
/**
 * Secondary text in light (spec 019, RN-01): zinc-500 is 4.0:1 on the showroom grey (#e9ebef),
 * below AA, so a step between zinc-500 and zinc-600 takes its place: 5.0:1 on the page, 5.9:1 on a
 * white card and 4.7:1 on a grey chip (zinc-200). Found by the accessibility audit in light.
 */
const SECONDARY_ON_SHOWROOM = '#63636b';

export default heroui({
  layout: {
    radius: { small: '10px', medium: '14px', large: '22px' },
    borderWidth: { small: '1px', medium: '1px', large: '2px' },
  },
  themes: {
    light: {
      layout: {
        boxShadow: {
          small:
            'inset 0 1px 0 rgb(255 255 255 / 1), 0 1px 2px rgb(15 23 42 / 0.06), 0 18px 40px -22px rgb(15 23 42 / 0.45)',
        },
      },
      colors: {
        background: '#e9ebef',
        foreground: {
          ...colors.zinc,
          400: SECONDARY_ON_SHOWROOM,
          500: SECONDARY_ON_SHOWROOM,
          DEFAULT: '#18181b',
        },
        default: {
          ...(semanticColors.light.default as Record<string, string>),
          500: SECONDARY_ON_SHOWROOM,
        },
        primary: { DEFAULT: '#3f3f46', foreground: '#ffffff' },
        divider: 'rgba(9, 9, 11, 0.07)',
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
      layout: {
        boxShadow: {
          small: 'inset 0 1px 0 rgb(255 255 255 / 0.06), 0 20px 50px -24px rgb(0 0 0 / 0.9)',
        },
      },
      colors: {
        background: '#050506',
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
        content1: '#0d0d10',
        content2: colors.zinc[800],
        content3: colors.zinc[700],
        content4: colors.zinc[600],
        divider: 'rgba(255, 255, 255, 0.08)',
        primary: { DEFAULT: '#d4d4d8', foreground: '#0a0a0a' },
        // One step lighter than HeroUI's dark DEFAULT (#f31260, 4.27:1 on a card): field errors
        // reach AA on the cards (#f54180 on #18181b, about 5:1). Found by the dark audit.
        danger: { ...(semanticColors.dark.danger as Record<string, string>), DEFAULT: '#f54180' },
        focus: colors.zinc[300],
      },
    },
  },
});
