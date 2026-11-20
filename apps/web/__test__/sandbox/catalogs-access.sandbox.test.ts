/**
 * What each role reaches of the catalogs through the public API, with its own session (spec 007).
 * Uses the local seeds (seeds/04_catalogs.sql): «Polichado» is the disabled service and «Diego
 * Desactivado» the disabled employee.
 *
 * Guards:
 * - CA-15 / CA-17 / RN-01: an operator reads the active services and cannot register, correct or
 *   disable one, whatever they send.
 * - CA-18: a customer reads nothing of the catalogs.
 * - CA-14 / RN-02: not even an admin deletes a service: it is only disabled.
 * - CA-16 / RN-07: an operator reads only the names of the active employees, nothing of their
 *   document, phone or commission; CA-17: nor registers one through save_employee.
 */
import { SEED, adminClient, signedInAs } from './support/sandbox';

describe('services through the API (spec 007)', () => {
  it('an operator reads only the active services (CA-15)', async () => {
    const { client } = await signedInAs(SEED.operator);

    const { data, error } = await client.from('services').select('name, disabled_at');

    expect(error).toBeNull();
    expect(data?.map(({ name }) => name)).toContain('Lavado sencillo');
    expect(data?.map(({ name }) => name)).not.toContain('Polichado');
    expect(data?.every(({ disabled_at }) => disabled_at === null)).toBe(true);
  });

  it('an operator cannot register a service, nor disable one (CA-17, RN-01)', async () => {
    const { client } = await signedInAs(SEED.operator);

    const insert = await client.from('services').insert({ name: 'Del operador', price_car: 1000 });
    const disable = await client
      .from('services')
      .update({ disabled_at: new Date().toISOString() })
      .eq('name', 'Lavado sencillo')
      .select('id');

    expect(insert.error?.code).toBe('42501');
    // RLS hides the row from the update: nothing changes.
    expect(disable.data).toEqual([]);
    const { data } = await adminClient()
      .from('services')
      .select('disabled_at')
      .eq('name', 'Lavado sencillo')
      .single();
    expect(data?.disabled_at).toBeNull();
  });

  it('a customer reads no service (CA-18)', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { data } = await client.from('services').select('id');

    expect(data).toEqual([]);
  });

  it('not even an admin deletes a service: it is only disabled (CA-14, RN-02)', async () => {
    const { client } = await signedInAs(SEED.admin);

    const { error } = await client.from('services').delete().eq('name', 'Polichado');

    expect(error?.code).toBe('42501');
    const { count } = await adminClient()
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('name', 'Polichado');
    expect(count).toBe(1);
  });
});

describe('employees through the API (spec 007)', () => {
  it('an operator reads only the names of the active employees (CA-16)', async () => {
    const { client } = await signedInAs(SEED.operator);

    const { data, error } = await client.from('employees').select('full_name');

    expect(error).toBeNull();
    expect(data?.map(({ full_name }) => full_name)).toEqual(['Elkin Estrada', 'Paula Pineda']);
  });

  it('an operator reads no document, phone or commission (CA-16, RN-07)', async () => {
    const { client } = await signedInAs(SEED.operator);

    const direct = await client.from('employee_details').select('document_number');
    const embedded = await client
      .from('employees')
      .select('full_name, employee_details(document_number, commission_pct)');

    expect(direct.data).toEqual([]);
    expect(embedded.data?.every(({ employee_details }) => employee_details === null)).toBe(true);
  });

  it('an operator cannot register an employee (CA-17)', async () => {
    const { client } = await signedInAs(SEED.operator);

    const { error } = await client.rpc('save_employee', {
      p_full_name: 'Del Operador',
      p_document_type: 'cc',
      p_document_number: '11223344',
      p_commission_pct: 10,
    });

    expect(error?.code).toBe('42501');
  });

  it('a customer reads no employee (CA-18)', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { data } = await client.from('employees').select('id');

    expect(data).toEqual([]);
  });
});
