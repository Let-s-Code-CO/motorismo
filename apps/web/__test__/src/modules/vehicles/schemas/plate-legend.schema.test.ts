/**
 * plate-legend.schema — the legend an admin gives a municipality for its plates (spec 023, CA-10,
 * RN-05).
 *
 * It is written as plates are stamped: capitals (what is typed in lower case is raised), without
 * accents, letters, digits, spaces and «. , -» only, and at most 17 characters, what fits inside the
 * frame with the norm's letters. Left empty, the plate shows the municipality's name.
 */
import { plateLegendSchema } from '@web/modules/vehicles/schemas/plate-legend.schema';

const parse = (legend: string) => plateLegendSchema.safeParse({ code: '11001', legend });

describe('plateLegendSchema', () => {
  it.each([
    ['STFE DE BOGOTA', 'STFE DE BOGOTA'],
    ['stfe de bogota', 'STFE DE BOGOTA'],
    ['  bogota d.c.  ', 'BOGOTA D.C.'],
    ['peñol', 'PEÑOL'],
    // 17 characters: the longest that fits.
    ['ABCDEFGHIJKLMNOPQ', 'ABCDEFGHIJKLMNOPQ'],
  ])('takes «%s» as «%s»', (typed, legend) => {
    expect(parse(typed)).toMatchObject({ success: true, data: { legend } });
  });

  it('takes an empty legend as none: the plate shows the name again', () => {
    expect(parse('   ')).toMatchObject({ success: true, data: { legend: null } });
  });

  it.each([
    ['accents', 'BOGOTÁ', 'legendAccents'],
    ['other signs', 'BOGOTA!', 'legendInvalid'],
    ['18 characters', 'ABCDEFGHIJKLMNOPQR', 'legendTooLong'],
  ])('refuses a legend with %s', (_, typed, error) => {
    const result = parse(typed);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(error);
  });
});
