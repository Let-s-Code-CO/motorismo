/**
 * PlateLabel — a vehicle's plate drawn like a Colombian plate (spec 005, HU-07).
 *
 * Staff recognise the vehicle that arrives by its plate, so it looks like the real one (CA-27):
 * - a car plate is one row (ABC-123) with the city that issued it below, in capitals;
 * - a motorcycle plate looks the same, one row (UIH-03D, JWJ-07 for the old ones), with "COLOMBIA"
 *   below instead of a city;
 * - in the "Clientes" table it is compact: one line, no city and no "COLOMBIA" (CA-29).
 * The drawing is never the only way to read it (CA-28): assistive technologies get the plate with
 * its hyphen (UIH-03D) and, for a car, its city; what is only decoration is hidden from them.
 * Every plate has the same width, whatever its letters (a list of plates lines up), wide enough for
 * the widest plate; a long city name is never cut: its small print shrinks to fit (spec 022, CA-11).
 */
import { screen } from '@testing-library/react';

import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';

import { renderWithProviders } from '@tests/test-utils/render';

/** True when assistive technologies skip the element (it sits under aria-hidden). */
const isHiddenFromReaders = (element: HTMLElement) =>
  element.closest('[aria-hidden="true"]') !== null;

describe('PlateLabel', () => {
  it('draws a car plate in one row with its issuing city below, in capitals (CA-27)', () => {
    renderWithProviders(<PlateLabel plate="ABC123" city="Bogotá, D.C." />);

    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.getByText('BOGOTÁ, D.C.')).toBeInTheDocument();
    expect(screen.queryByText('COLOMBIA')).not.toBeInTheDocument();
  });

  it('reads a car plate with its city to assistive technologies (CA-28)', () => {
    renderWithProviders(<PlateLabel plate="ABC123" city="Bogotá, D.C." />);

    const readable = screen.getByText('ABC-123, Bogotá, D.C.');
    expect(isHiddenFromReaders(readable)).toBe(false);
    expect(isHiddenFromReaders(screen.getByText('BOGOTÁ, D.C.'))).toBe(true);
  });

  it('draws a motorcycle plate like a car plate: one row with its hyphen, COLOMBIA below (CA-27)', () => {
    renderWithProviders(<PlateLabel plate="UIH03D" />);

    expect(screen.getByText('UIH-03D')).toBeInTheDocument();
    expect(screen.getByText('COLOMBIA')).toBeInTheDocument();
    expect(screen.queryByText('UIH')).not.toBeInTheDocument();
  });

  it('draws an old motorcycle plate (jwj 07) as JWJ-07 (CA-27, RN-03)', () => {
    renderWithProviders(<PlateLabel plate="jwj 07" />);

    expect(screen.getByText('JWJ-07')).toBeInTheDocument();
    expect(screen.getByText('COLOMBIA')).toBeInTheDocument();
  });

  it('reads a motorcycle plate as UIH-03D and hides the decorative COLOMBIA (CA-28)', () => {
    renderWithProviders(<PlateLabel plate="UIH03D" />);

    expect(isHiddenFromReaders(screen.getByText('UIH-03D'))).toBe(false);
    expect(isHiddenFromReaders(screen.getByText('COLOMBIA'))).toBe(true);
  });

  it.each([
    ['UIH03D', 'UIH-03D'],
    ['ABC123', 'ABC-123'],
  ])(
    'is compact in a table: %s in one readable line, without city nor COLOMBIA (CA-29)',
    (plate, shown) => {
      renderWithProviders(<PlateLabel plate={plate} city="Bogotá, D.C." size="sm" />);

      const line = screen.getByText(shown);
      expect(isHiddenFromReaders(line)).toBe(false);
      expect(screen.queryByText('UIH')).not.toBeInTheDocument();
      expect(screen.queryByText('COLOMBIA')).not.toBeInTheDocument();
      expect(screen.queryByText(/Bogotá|BOGOTÁ/)).not.toBeInTheDocument();
    }
  );

  it.each([
    ['md', 'UIH03D', 'WMW88W'],
    ['sm', 'UIH03D', 'WMW88W'],
  ] as const)(
    'gives every %s plate the same width, whatever its letters (%s and %s)',
    (size, narrow, wide) => {
      const { container } = renderWithProviders(
        <>
          <PlateLabel plate={narrow} size={size} />
          <PlateLabel plate={wide} size={size} />
        </>
      );
      const [first, second] = container.querySelectorAll<HTMLElement>('[data-plate]');
      // One fixed width class, the same for both: no width that depends on the text.
      const width = (plate: HTMLElement) => plate.className.match(/\bw-\[[^\]]+\]/g);
      expect(width(first!)).toHaveLength(1);
      expect(width(first!)).toEqual(width(second!));
      expect(first!.className).not.toMatch(/\bmin-w-/);
    }
  );

  it('never cuts a long city: it keeps the whole name and shrinks its small print to fit', () => {
    renderWithProviders(
      <>
        <PlateLabel plate="ABC123" city="Cali" />
        <PlateLabel plate="ABC124" city="San Antonio del Tequendama" />
      </>
    );

    const short = screen.getByText('CALI');
    const long = screen.getByText('SAN ANTONIO DEL TEQUENDAMA');
    expect(long.className).not.toMatch(/\btruncate\b/);
    // A short name keeps the plate's small print; a long one is smaller, never cut.
    expect(short.style.fontSize).toBe('');
    expect(Number.parseFloat(long.style.fontSize)).toBeLessThan(6.5);
    expect(Number.parseFloat(long.style.fontSize)).toBeGreaterThan(4);
  });
});
