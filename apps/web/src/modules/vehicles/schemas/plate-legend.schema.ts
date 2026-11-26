import { z } from 'zod';

/** At most what fits inside the frame with the norm's letters: 17 · n − 5 mm (spec 023, RN-05). */
export const PLATE_LEGEND_MAX = 17;

/** Accent marks, as Unicode stores them apart from their letter. */
const ACCENTED = /[ÁÉÍÓÚÜÀÈÌÒÙÂÊÎÔÛ]/;

/**
 * The legend an admin gives a municipality for its plates (spec 023, CA-10): written as plates are
 * stamped, in capitals (what is typed in lower case is raised), without accents, with letters, digits,
 * spaces and «. , -», at most 17 characters. Empty means none: the plate shows the name again.
 * The database checks the same rule (`municipalities_plate_legend_format`).
 */
export const plateLegendSchema = z.object({
  code: z.string().regex(/^\d{5}$/),
  legend: z
    .string()
    .trim()
    .transform((legend) => legend.toLocaleUpperCase('es-CO'))
    .check((ctx) => {
      const legend = ctx.value;
      if (!legend) return;
      if (ACCENTED.test(legend))
        ctx.issues.push({ code: 'custom', message: 'legendAccents', input: legend });
      else if (!/^[A-ZÑ0-9 .,-]+$/.test(legend))
        ctx.issues.push({ code: 'custom', message: 'legendInvalid', input: legend });
      else if (legend.length > PLATE_LEGEND_MAX)
        ctx.issues.push({ code: 'custom', message: 'legendTooLong', input: legend });
    })
    .transform((legend) => legend || null),
});

export type PlateLegendInput = z.input<typeof plateLegendSchema>;
