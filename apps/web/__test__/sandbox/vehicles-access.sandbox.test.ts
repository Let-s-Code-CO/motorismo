/**
 * What a customer can do with vehicles through the public API with their own session (spec 005).
 *
 * Guards CA-26: a customer who bypasses the UI only reads their own vehicles, and cannot create,
 * change, retire or move vehicles of another customer — neither with direct table requests nor
 * through save_vehicle — nor write the catalog directly. CA-25 / RN-08: a plate held by another
 * customer is refused without saying whose it is.
 *
 * Uses the seeds: Camila (cliente@) has UIH-03D (and the retired JWJ-07); Valentina, a customer
 * without account, has the car KDM-482. Every request here is refused, so nothing changes.
 */
import { SEED, adminClient, signedInAs } from './support/sandbox';

const idOf = async (email: string) => {
  const { data } = await adminClient().from('customers').select('id').eq('email', email).single();
  return data!.id;
};

const valentinaCar = async () => {
  const { data } = await adminClient()
    .from('vehicles')
    .select('id, color, retired_at, customer_id')
    .eq('plate', 'KDM482')
    .single();
  return data!;
};

const VALENTINA = 'valentina.vasquez@correo.test';

describe('a customer calling the API directly (CA-26)', () => {
  it('only reads their own vehicles', async () => {
    const { client } = await signedInAs(SEED.customer);
    const own = await idOf(SEED.customer);

    const { data, error } = await client.from('vehicles').select('customer_id, plate');

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((vehicle) => vehicle.customer_id === own)).toBe(true);
    expect(data!.map((vehicle) => vehicle.plate)).not.toContain('KDM482');
  });

  it('cannot register a vehicle for another customer, neither with save_vehicle nor directly', async () => {
    const { client } = await signedInAs(SEED.customer);
    const other = await idOf(VALENTINA);

    const viaFunction = await client.rpc('save_vehicle', {
      p_customer_id: other,
      p_vehicle_type: 'bicycle',
      p_vehicle_class: 'road',
      p_brand_name: 'GW',
      p_color: 'white',
    });
    const { data: brand } = await client
      .from('vehicle_brands')
      .select('id')
      .eq('vehicle_type', 'bicycle')
      .eq('name', 'GW')
      .single();
    const direct = await client.from('vehicles').insert({
      customer_id: other,
      vehicle_type: 'bicycle',
      vehicle_class: 'road',
      brand_id: brand!.id,
      color: 'white',
    });

    expect(viaFunction.error?.code).toBe('42501');
    expect(direct.error?.code).toBe('42501');
  });

  it('cannot change nor retire the vehicle of another customer: no row changes', async () => {
    const { client } = await signedInAs(SEED.customer);
    const before = await valentinaCar();

    const changed = await client
      .from('vehicles')
      .update({ color: 'red' })
      .eq('id', before.id)
      .select();
    const retired = await client
      .from('vehicles')
      .update({ retired_at: new Date().toISOString() })
      .eq('id', before.id)
      .select();
    const viaFunction = await client.rpc('save_vehicle', {
      p_vehicle_id: before.id,
      p_customer_id: await idOf(SEED.customer),
      p_vehicle_type: 'car',
      p_vehicle_class: 'utility',
      p_brand_name: 'Mazda',
      p_line_name: 'CX-30',
      p_color: 'red',
      p_plate: 'KDM482',
      p_plate_city_code: '11001',
    });

    expect(changed.data).toEqual([]);
    expect(retired.data).toEqual([]);
    expect(viaFunction.error?.hint).toBe('vehicle_not_found');
    expect(await valentinaCar()).toEqual(before);
  });

  it('cannot move a vehicle of their own to another customer', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { error } = await client
      .from('vehicles')
      .update({ customer_id: await idOf(VALENTINA) } as never)
      .eq('plate', 'UIH03D');

    expect(error?.code).toBe('42501');
  });

  it('cannot write the catalog directly (it only grows through save_vehicle)', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { error } = await client
      .from('vehicle_brands')
      .insert({ vehicle_type: 'motorcycle', name: 'Marca Directa' } as never);

    expect(error?.code).toBe('42501');
  });

  it('learns that a plate is taken, and not whose it is (CA-25, RN-08)', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { error } = await client.rpc('save_vehicle', {
      p_customer_id: await idOf(SEED.customer),
      p_vehicle_type: 'car',
      p_vehicle_class: 'automobile',
      p_brand_name: 'Mazda',
      p_line_name: 'Mazda 3',
      p_color: 'black',
      p_plate: 'kdm-482',
      p_plate_city_code: '11001',
    });

    expect(error?.hint).toBe('vehicle_plate_taken');
    expect(JSON.stringify(error)).not.toMatch(/Valentina|valentina|KDM482.*customer/);
  });
});
