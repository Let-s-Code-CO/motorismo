/**
 * VehicleSummary — one vehicle as staff and its owner see it (spec 005).
 *
 * Guards:
 * - CA-03: a motorcycle shows "Marca Línea", its displacement as "600 cc" and the plate formatted
 *   with a hyphen (UIH03D → UIH-03D);
 * - CA-05 / RN-10: a car or bicycle shows its class (Camioneta, Ruta…) instead of a displacement;
 * - CA-06: a bicycle has no plate, and says so;
 * - CA-16: the colour shows its NAME next to the swatch (never the swatch alone);
 * - CA-27: a car's plate shows the city that issued it.
 */
import { screen } from '@testing-library/react';

import VehicleSummary from '@web/modules/vehicles/components/molecules/vehicle-summary.component';

import { buildVehicle } from '@tests/test-utils/builders';
import { renderWithProviders } from '@tests/test-utils/render';

describe('VehicleSummary', () => {
  it('shows a motorcycle with brand and line, displacement, colour and formatted plate (CA-03)', () => {
    renderWithProviders(<VehicleSummary vehicle={buildVehicle()} />);

    expect(screen.getByText('Suzuki GSX-R600')).toBeInTheDocument();
    expect(screen.getByText('600 cc')).toBeInTheDocument();
    expect(screen.getByText('Negro')).toBeInTheDocument();
    expect(screen.getByText('UIH-03D')).toBeInTheDocument();
  });

  it('shows the class of a car instead of a displacement (RN-10)', () => {
    renderWithProviders(
      <VehicleSummary
        vehicle={buildVehicle({
          vehicle_type: 'car',
          vehicle_class: 'utility',
          displacement_cc: null,
          brand: { name: 'Mazda' },
          line: { name: 'CX-30' },
          plate: 'ABC123',
        })}
      />
    );

    expect(screen.getByText('Mazda CX-30')).toBeInTheDocument();
    expect(screen.getByText('Camioneta')).toBeInTheDocument();
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.queryByText(/cc$/)).not.toBeInTheDocument();
  });

  it("shows a car's plate with the city that issued it, in capitals (CA-27)", () => {
    renderWithProviders(
      <VehicleSummary
        vehicle={buildVehicle({
          vehicle_type: 'car',
          vehicle_class: 'automobile',
          displacement_cc: null,
          brand: { name: 'Renault' },
          line: { name: 'Logan' },
          plate: 'FUN123',
          plate_city: { name: 'Funza' },
        })}
      />
    );

    expect(screen.getByText('FUN-123')).toBeInTheDocument();
    expect(screen.getByText('FUNZA')).toBeInTheDocument();
  });

  it('shows a bicycle without line or plate, with its class (CA-06)', () => {
    renderWithProviders(
      <VehicleSummary
        vehicle={buildVehicle({
          vehicle_type: 'bicycle',
          vehicle_class: 'road',
          displacement_cc: null,
          brand: { name: 'GW' },
          line: null,
          plate: null,
          color: 'multicolor',
        })}
      />
    );

    expect(screen.getByText('GW')).toBeInTheDocument();
    expect(screen.getByText('Ruta')).toBeInTheDocument();
    expect(screen.getByText('Sin placa')).toBeInTheDocument();
    expect(screen.getByText('Multicolor')).toBeInTheDocument();
  });

  it('names the colour next to a decorative swatch (CA-16)', () => {
    const { container } = renderWithProviders(
      <VehicleSummary vehicle={buildVehicle({ color: 'burgundy' })} />
    );

    expect(screen.getByText('Vinotinto')).toBeInTheDocument();
    expect(container.querySelector('[data-swatch="burgundy"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });
});
