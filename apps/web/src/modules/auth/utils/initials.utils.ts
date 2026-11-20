/**
 * The letters an avatar shows without a photo: first letter of the first two words, upper case.
 * The phone's account button names itself with them too (spec 009, CA-04; WCAG 2.5.3).
 */
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('es-CO'))
    .join('');
