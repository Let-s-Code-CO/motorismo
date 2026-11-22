/**
 * What a customer with an account does through the API (spec 014), against the local database and its
 * seeds: Camila (cliente@motorismo.test) has an open order (#4) and a reservation for tomorrow at
 * 10:00 she booked herself; Valentina has another for tomorrow at 10:00.
 *
 * Guards (through the real API, whose connections refuse an UPDATE without WHERE):
 * - CA-12 / CA-19: the customer books a seat for themselves and cancels it.
 * - CA-21: never another customer's reservation.
 * - CA-01 / RN-01: their order in the shop comes through my_shop_orders; the orders table itself
 *   stays closed to them.
 */
import { SEED, adminClient, signedInAs } from './support/sandbox';

/** Tomorrow at 5:00 p. m. in Bogotá: the last slot, which the seeds leave free. */
const tomorrowAtFive = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  // 22:00 UTC is 5:00 p. m. in Bogotá (UTC−5).
  return new Date(Date.UTC(year!, month! - 1, day! + 1, 22)).toISOString();
};

const created: string[] = [];
const vehicles: string[] = [];

afterAll(async () => {
  const admin = adminClient();
  await admin.from('reservation_services').delete().in('reservation_id', created);
  await admin.from('reservations').delete().in('id', created);
  await admin.from('vehicles').delete().in('id', vehicles);
});

describe('the customer area through the API (spec 014)', () => {
  it('a customer books a seat for themselves, then cancels it (CA-12, CA-19)', async () => {
    const { client } = await signedInAs(SEED.customer);
    const { data: me } = await client.from('customers').select('id').single();
    // The seeds already give Camila one pending reservation per vehicle and one without vehicle
    // (the app's limit, RN-03): she registers another motorcycle of her own first.
    const { data: vehicle } = await client.rpc('save_vehicle', {
      p_customer_id: me!.id,
      p_vehicle_type: 'motorcycle',
      p_brand_name: 'Honda',
      p_line_name: 'CB 190R',
      p_color: 'red',
      p_plate: `SBX${String(Date.now()).slice(-2)}Z`,
    });
    vehicles.push(vehicle!);

    const booked = await client.rpc('save_reservation', {
      p_customer_id: me!.id,
      p_vehicle_id: vehicle!,
      p_slot_start: tomorrowAtFive(),
      p_service_ids: [],
    });
    expect(booked.error).toBeNull();
    created.push(booked.data!);

    const cancelled = await client.rpc('cancel_reservation', { p_id: booked.data! });
    expect(cancelled.error).toBeNull();

    const { data } = await adminClient()
      .from('reservations')
      .select('status, booked_by_customer, cancelled_by_customer')
      .eq('id', booked.data!)
      .single();
    expect(data).toEqual({
      status: 'cancelled',
      booked_by_customer: true,
      cancelled_by_customer: true,
    });
  });

  it('a customer cannot cancel another customer’s reservation (CA-21)', async () => {
    const { client } = await signedInAs(SEED.customer);
    const { data: valentina } = await adminClient()
      .from('reservation_summaries')
      .select('id')
      .eq('customer_name', 'Valentina Vásquez')
      .eq('status', 'pending')
      .limit(1)
      .single();

    const { error } = await client.rpc('cancel_reservation', { p_id: valentina!.id! });

    expect(error?.hint).toBe('reservation_customer_only');
  });

  it('their order in the shop comes through my_shop_orders; the orders table stays closed (CA-01, RN-01)', async () => {
    const { client } = await signedInAs(SEED.customer);

    const [mine, table] = await Promise.all([
      client.rpc('my_shop_orders'),
      client.from('work_orders').select('id'),
    ]);

    expect(mine.error).toBeNull();
    expect(mine.data!.map((order) => order.number)).toContain(4);
    expect(table.data).toEqual([]);
  });
});
