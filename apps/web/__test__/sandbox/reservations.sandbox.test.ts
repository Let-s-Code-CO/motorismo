/**
 * Booking the last seats at the same time, against the local database (spec 012, CA-06, RN-02).
 * Uses the local seeds (seeds/06_reservations.sql: this week and the next are enabled, from 9:00
 * to 18:00, with 2 seats per slot).
 *
 * Guards:
 * - CA-06 / RN-02: when several people book the same slot at once, the slot never gets more
 *   reservations than seats; the others are told it is full. save_reservation locks the day before
 *   counting, so concurrent bookings line up.
 * - RN-06: a customer cannot book.
 * - CA-29: an admin changes the seats per slot (and the slot length and the tolerance) through the
 *   API. The API's connections refuse an UPDATE without WHERE (Supabase's safeupdate), which pgTAP,
 *   run as the superuser, never sees: only this test does.
 */
import { SEED, adminClient, signedInAs } from './support/sandbox';

/** Tomorrow at 4:00 p. m. in Bogotá, a slot the seeds leave free. */
const tomorrowAtFour = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  // 21:00 UTC is 4:00 p. m. in Bogotá (UTC−5).
  return new Date(Date.UTC(year!, month! - 1, day! + 1, 21)).toISOString();
};

const created: string[] = [];

afterAll(async () => {
  const admin = adminClient();
  await admin.from('reservation_services').delete().in('reservation_id', created);
  await admin.from('reservations').delete().in('id', created);
});

describe('reservations through the API (spec 012)', () => {
  it('never books more reservations than seats, even at the same time (CA-06, RN-02)', async () => {
    const slot = tomorrowAtFour();
    const { data: customers } = await adminClient()
      .from('customers')
      .select('id')
      .is('disabled_at', null)
      .limit(4);
    const [operator, admin] = await Promise.all([
      signedInAs(SEED.operator),
      signedInAs(SEED.admin),
    ]);

    // 8 bookings at once for a slot of 2 seats, from two people, without vehicle.
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        (index % 2 ? operator : admin).client.rpc('save_reservation', {
          p_customer_id: customers![index % customers!.length]!.id,
          p_vehicle_id: null as unknown as string,
          p_slot_start: slot,
          p_service_ids: [],
        })
      )
    );
    created.push(...results.flatMap(({ data }) => (data ? [data] : [])));

    const booked = results.filter(({ error }) => !error);
    const refused = results.filter(({ error }) => error);
    expect(booked).toHaveLength(2);
    expect(refused.map(({ error }) => error!.hint)).toEqual(Array(6).fill('reservation_slot_full'));

    const { count } = await adminClient()
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('slot_start', slot)
      .eq('status', 'pending');
    expect(count).toBe(2);
  });

  it('a customer cannot book (RN-06)', async () => {
    const { client } = await signedInAs(SEED.customer);
    const { data: me } = await client.from('customers').select('id').single();

    const { error } = await client.rpc('save_reservation', {
      p_customer_id: me!.id,
      p_vehicle_id: null as unknown as string,
      p_slot_start: tomorrowAtFour(),
      p_service_ids: [],
    });

    expect(error?.hint).toBe('reservation_staff_only');
  });
});

describe('the agenda settings through the API (spec 012, CA-29)', () => {
  const restore = async () => {
    const { client } = await signedInAs(SEED.admin);
    await client.rpc('save_agenda_settings', {
      p_slot_minutes: 60,
      p_seats: 2,
      p_tolerance_minutes: 15,
    });
  };
  afterEach(restore);

  it('an admin sets a third seat per slot', async () => {
    const { client } = await signedInAs(SEED.admin);

    const { error } = await client.rpc('save_agenda_settings', {
      p_slot_minutes: 60,
      p_seats: 3,
      p_tolerance_minutes: 15,
    });

    expect(error).toBeNull();
    const { data } = await adminClient()
      .from('agenda_settings')
      .select('slot_minutes, seats, tolerance_minutes')
      .single();
    expect(data).toEqual({ slot_minutes: 60, seats: 3, tolerance_minutes: 15 });
  });
});
