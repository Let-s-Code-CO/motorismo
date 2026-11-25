/**
 * BookingEstimate — how long what the customer chooses to book will take (spec 021, HU-02).
 *
 * Guards:
 * - CA-06: with services chosen, the sum of their times, written as staff write it («≈ 2 h»).
 * - CA-07: services without a time are named («Sin estimar: …»); with none timed, no estimate.
 * - CA-08: with nothing chosen, nothing is shown.
 * - RN-02: only shown; it changes neither slots nor tolerance (no input of its own).
 * The text sits in a polite live region that is always there, so a screen reader hears each change
 * without being interrupted.
 */
import { screen } from '@testing-library/react';

import BookingEstimate from '@web/modules/customer-area/components/molecules/booking-estimate.component';

import { renderWithProviders } from '@tests/test-utils/render';

/** The live region: no role of its own (the form already has a status for a closed day). */
const region = () => document.querySelector<HTMLElement>('[data-booking-estimate]')!;

type Service = { name: string; estimated_minutes: number | null };
const service = (overrides: Partial<Service> = {}): Service => ({
  name: 'Lavado sencillo',
  estimated_minutes: 30,
  ...overrides,
});

describe('BookingEstimate', () => {
  it('adds up the times of the chosen services: 30 + 90 min = «≈ 2 h» (CA-06)', () => {
    renderWithProviders(
      <BookingEstimate
        services={[service(), service({ name: 'Lavado detallado', estimated_minutes: 90 })]}
      />
    );

    expect(region()).toHaveTextContent('Tiempo estimado: ≈ 2 h');
    expect(screen.queryByText(/Sin estimar/)).not.toBeInTheDocument();
  });

  it('names the chosen services that have no time, after the sum of the others (CA-07)', () => {
    renderWithProviders(
      <BookingEstimate
        services={[service(), service({ name: 'Micropulido', estimated_minutes: null })]}
      />
    );

    expect(region()).toHaveTextContent('Tiempo estimado: ≈ 30 minSin estimar: Micropulido');
  });

  it('says there is no estimate when none of the chosen services has a time (CA-07)', () => {
    renderWithProviders(
      <BookingEstimate services={[service({ name: 'Micropulido', estimated_minutes: null })]} />
    );

    expect(region()).toHaveTextContent('Sin tiempo estimado');
    expect(screen.queryByText(/Tiempo estimado:/)).not.toBeInTheDocument();
  });

  it('shows nothing while no service is chosen, keeping its live region ready (CA-08)', () => {
    renderWithProviders(<BookingEstimate services={[]} />);

    expect(region()).toBeEmptyDOMElement();
    expect(region()).toHaveAttribute('aria-live', 'polite');
  });
});
