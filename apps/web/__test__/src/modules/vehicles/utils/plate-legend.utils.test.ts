/**
 * plate-legend.utils — what a car plate says under its characters (spec 023, HU-03, RN-05).
 *
 * The legend is the municipality's own one when the admin gave it one («STFE DE BOGOTA»); otherwise
 * its name in capitals and without accents, as plates are stamped («BOGOTA, D.C.»), keeping the Ñ and
 * the other signs. A motorcycle plate says «COLOMBIA» instead (that is the plate's, not this rule's).
 */
import { plateLegend } from '@web/modules/vehicles/utils/plate-legend.utils';

describe('plateLegend', () => {
  it.each([
    ['Bogotá, D.C.', 'BOGOTA, D.C.'],
    ['Medellín', 'MEDELLIN'],
    ['San José del Guaviare', 'SAN JOSE DEL GUAVIARE'],
    ['Peñol', 'PEÑOL'],
    ['Güepsa', 'GUEPSA'],
  ])('writes «%s» in capitals without accents, keeping the Ñ: %s (CA-09)', (name, legend) => {
    expect(plateLegend(name, null)).toBe(legend);
  });

  it("uses the municipality's own legend when it has one (CA-10)", () => {
    expect(plateLegend('Bogotá, D.C.', 'STFE DE BOGOTA')).toBe('STFE DE BOGOTA');
  });

  it('gives nothing without a city', () => {
    expect(plateLegend(null, null)).toBeNull();
    expect(plateLegend(undefined, undefined)).toBeNull();
  });
});
