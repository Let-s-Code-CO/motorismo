/** Accent marks, as Unicode stores them apart from their letter («á» = «a» + «´»). */
const ACCENTS = /[̀-ͯ]/g;

/**
 * What a car plate says under its characters (spec 023, RN-05): the municipality's own legend when
 * the admin gave it one, or else its name in capitals and without accents, as plates are stamped
 * («Bogotá, D.C.» → «BOGOTA, D.C.»). The Ñ is a letter, not an accented N: it stays.
 */
export const plateLegend = (
  city: string | null | undefined,
  legend: string | null | undefined
): string | null => {
  if (legend) return legend;
  if (!city) return null;
  return city
    .toLocaleUpperCase('es-CO')
    .split('Ñ')
    .map((part) => part.normalize('NFD').replace(ACCENTS, ''))
    .join('Ñ');
};
