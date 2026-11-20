import { PREFERS_DARK } from '@web/modules/theme/constants/theme.constants';

/**
 * Runs in `<head>` before anything is painted (spec 010, CA-01, RF-03). The server already paints
 * «Claro» and «Oscuro» from the cookie; only «Sistema» depends on the device, which the server
 * cannot know: this asks it and sets the `dark` class and the colour scheme, so the page never
 * flashes the wrong theme (the system bar follows the device by itself: two `theme-color` with
 * their `media`, from `generateViewport`). Plain ES5 and self-contained: it runs before any bundle.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement;if(d.getAttribute('data-theme-choice')!=='system')return;var dark=window.matchMedia('${PREFERS_DARK}').matches;d.classList.toggle('dark',dark);d.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;
