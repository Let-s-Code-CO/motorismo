/**
 * PlateLabel — a vehicle's plate drawn as the Colombian norm draws it (spec 023, HU-01; amends spec 005,
 * HU-07).
 *
 * Staff recognise the vehicle that arrives by its plate, so it is the real one, to scale:
 * - a vector drawing in millimetres: 330 × 160 for a car, 235 × 105 for a motorcycle (CA-01, CA-02);
 * - the characters traced from the norm's drawings, not a typeface (CA-04), with a discreet circle
 *   between letters and digits instead of the Ministry's logo (RN-03);
 * - below, the city that issued a car plate (its own legend or its name without accents, RN-05) or
 *   «COLOMBIA» on a motorcycle's;
 * - every plate of one size has the same width, whatever its letters (CA-03); in lists of customers,
 *   the same whole plate, a little smaller (CA-12): there is no one-line version any more.
 * The drawing is never the only way to read it (CA-06): assistive technologies hear the plate with its
 * hyphen and, for a car, its city; the drawing, the circle and «COLOMBIA» are hidden from them.
 */
import { screen } from '@testing-library/react';

import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';
import { PLATE_GLYPHS } from '@web/modules/vehicles/constants/plate-glyphs.constants';

import { renderWithProviders } from '@tests/test-utils/render';

const draw = (element: React.ReactElement) => {
  const { container } = renderWithProviders(element);
  const plate = container.querySelector<HTMLElement>('[data-plate]')!;
  return { container, plate, svg: plate.querySelector('svg')! };
};

/** The path data of every character drawn in the plate's row (the legend excluded). */
const drawnCharacters = (svg: SVGSVGElement) =>
  [...svg.querySelectorAll('[data-characters] path')].map((path) => path.getAttribute('d'));

describe('PlateLabel', () => {
  it('draws a car plate on the norm’s 330 × 160 mm box (CA-01)', () => {
    const { svg } = draw(<PlateLabel plate="ABC123" city="Bogotá, D.C." />);

    expect(svg.getAttribute('viewBox')).toBe('0 0 330 160');
  });

  it('draws a motorcycle plate on the norm’s 235 × 105 mm box (CA-02)', () => {
    const { svg } = draw(<PlateLabel plate="UIH03D" />);

    expect(svg.getAttribute('viewBox')).toBe('0 0 235 105');
  });

  it('draws each character with its glyph traced from the norm, O and 0 apart (CA-04)', () => {
    const { svg } = draw(<PlateLabel plate="OOO000" />);

    const { glyphs } = PLATE_GLYPHS.car;
    expect(drawnCharacters(svg)).toEqual([
      glyphs.O,
      glyphs.O,
      glyphs.O,
      glyphs['0'],
      glyphs['0'],
      glyphs['0'],
    ]);
    expect(glyphs.O).not.toBe(glyphs['0']);
  });

  it('draws a motorcycle’s characters with the motorcycle set (CA-04)', () => {
    const { svg } = draw(<PlateLabel plate="UIH03D" />);

    expect(drawnCharacters(svg)[0]).toBe(PLATE_GLYPHS.moto.glyphs.U);
  });

  it('puts a discreet circle between letters and digits, never a logo (RN-03)', () => {
    const { svg } = draw(<PlateLabel plate="ABC123" city="Cali" />);

    const circle = svg.querySelector('circle')!;
    expect(circle.getAttribute('cx')).toBe('165');
    expect(svg.querySelector('image')).toBeNull();
  });

  it('writes under a car plate its city in capitals without accents (RN-05)', () => {
    const { plate } = draw(<PlateLabel plate="ABC123" city="Bogotá, D.C." />);

    expect(plate.dataset.legend).toBe('BOGOTA, D.C.');
  });

  it('writes the city’s own legend when it has one (CA-09)', () => {
    const { plate } = draw(
      <PlateLabel plate="ABC123" city="Bogotá, D.C." legend="STFE DE BOGOTA" />
    );

    expect(plate.dataset.legend).toBe('STFE DE BOGOTA');
  });

  it('writes COLOMBIA under a motorcycle plate, whatever its city (CA-02)', () => {
    const { plate } = draw(<PlateLabel plate="UIH03D" city="Bogotá, D.C." />);

    expect(plate.dataset.legend).toBe('COLOMBIA');
  });

  it('reads a car plate with its hyphen and its city; the drawing is hidden (CA-06)', () => {
    const { svg } = draw(<PlateLabel plate="ABC123" city="Bogotá, D.C." />);

    expect(screen.getByText('ABC-123').textContent).toBe('ABC-123, Bogotá, D.C.');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it.each([
    ['UIH03D', 'UIH-03D'],
    ['jwj 07', 'JWJ-07'],
  ])(
    'reads a motorcycle plate %s as %s, without the decorative COLOMBIA (CA-06)',
    (plate, read) => {
      draw(<PlateLabel plate={plate} />);

      expect(screen.getByText(read).textContent).toBe(read);
    }
  );

  it.each([
    ['md', 'w-[5rem]'],
    ['sm', 'w-[4.5rem]'],
  ] as const)(
    'gives every %s plate the same width (%s) and box, whatever its letters: UIH-03D and WMW-88W (CA-03)',
    (size, fixed) => {
      const { container } = renderWithProviders(
        <>
          <PlateLabel plate="UIH03D" size={size} />
          <PlateLabel plate="WMW88W" size={size} />
        </>
      );
      const [first, second] = container.querySelectorAll<HTMLElement>('[data-plate]');
      const width = (plate: HTMLElement) => plate.className.match(/\bw-\[[^\]]+\]/g);
      expect(width(first!)).toEqual([fixed]);
      expect(width(second!)).toEqual([fixed]);
      const box = (plate: HTMLElement) => plate.querySelector('svg')!.getAttribute('viewBox');
      expect(box(first!)).toBe(box(second!));
    }
  );

  it('draws the whole plate when small too, never a one-line version (CA-12)', () => {
    const { svg, plate } = draw(<PlateLabel plate="ABC123" city="Cali" size="sm" />);

    expect(svg.getAttribute('viewBox')).toBe('0 0 330 160');
    expect(drawnCharacters(svg)).toHaveLength(6);
    expect(plate.dataset.legend).toBe('CALI');
  });

  it('never cuts a long city: the whole legend is drawn, letter by letter (CA-09)', () => {
    const { svg } = draw(<PlateLabel plate="ABC123" city="San Antonio del Tequendama" />);

    // 26 characters, 3 of them spaces: 23 letters drawn.
    expect(svg.querySelectorAll('[data-legend-glyphs] path')).toHaveLength(23);
  });
});
