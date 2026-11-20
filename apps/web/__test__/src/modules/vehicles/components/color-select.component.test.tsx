/**
 * ColorSelect — the colour picker of the vehicle form (spec 005, HU-03).
 *
 * Guards CA-15 / RN-05: the colour is chosen from a fixed list (so every vehicle is described the
 * same way): the sixteen colours in the order of the spec, each with its NAME and a swatch, and
 * "Multicolor" with a swatch of several colours. The name is always there: the colour is never
 * told by the swatch alone (CA-16).
 */
import { fireEvent, screen, within } from '@testing-library/react';

import ColorSelect from '@web/modules/vehicles/components/molecules/color-select.component';

import { renderWithProviders } from '@tests/test-utils/render';

const NAMES = [
  'Negro',
  'Blanco',
  'Gris',
  'Plata',
  'Rojo',
  'Vinotinto',
  'Azul',
  'Verde',
  'Amarillo',
  'Naranja',
  'Café',
  'Beige',
  'Dorado',
  'Morado',
  'Rosado',
  'Multicolor',
];

const openList = () => {
  fireEvent.click(screen.getByRole('button', { name: /color/i }));
  return screen.getByRole('listbox');
};

describe('ColorSelect', () => {
  it('lists the sixteen colours of RN-05, in order, each with its name (CA-15)', () => {
    renderWithProviders(<ColorSelect value={null} onChange={vi.fn()} />);

    const options = within(openList()).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual(NAMES);
  });

  it('shows a swatch next to each name, and a several-colour one for "Multicolor"', () => {
    renderWithProviders(<ColorSelect value={null} onChange={vi.fn()} />);

    const list = openList();
    const red = within(list).getByRole('option', { name: 'Rojo' });
    const multicolor = within(list).getByRole('option', { name: 'Multicolor' });

    expect(red.querySelector('[data-swatch="red"]')).toBeInTheDocument();
    expect(multicolor.querySelector('[data-swatch="multicolor"]')).toBeInTheDocument();
  });

  it('reports the chosen colour by its value', () => {
    const onChange = vi.fn();
    renderWithProviders(<ColorSelect value={null} onChange={onChange} />);

    fireEvent.click(within(openList()).getByRole('option', { name: 'Vinotinto' }));

    expect(onChange).toHaveBeenCalledWith('burgundy');
  });

  it('shows the chosen colour with its name, and its error when there is one', () => {
    renderWithProviders(
      <ColorSelect value="black" onChange={vi.fn()} isInvalid errorMessage="Elige el color." />
    );

    expect(screen.getByRole('button', { name: /color/i })).toHaveTextContent('Negro');
    expect(screen.getByText('Elige el color.')).toBeInTheDocument();
  });
});
