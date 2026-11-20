/**
 * What each role reaches of the work orders through the public API, with its own session
 * (spec 008). Uses the local seeds (seeds/05_work_orders.sql).
 *
 * Guards:
 * - CA-14 / CA-24 / RN-06: nobody writes the order tables directly, not even an admin, and nobody
 *   deletes an order: every change goes through the functions, which apply the rules.
 * - RN-05: an operator cannot correct a closed order.
 * - A customer reads nothing of the orders (seeing their own is out of scope).
 */
import { SEED, signedInAs } from './support/sandbox';

describe('work orders through the API (spec 008)', () => {
  it('an operator reads the orders, with totals, through the summary view', async () => {
    const { client } = await signedInAs(SEED.operator);

    const { data, error } = await client
      .from('work_order_summaries')
      .select('number, status, total');

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(4);
  });

  it('nobody writes an order directly, not even an admin (CA-14)', async () => {
    const { client } = await signedInAs(SEED.admin);
    const { data: order } = await client.from('work_orders').select('id').limit(1).single();

    const update = await client.from('work_orders').update({ discount: 0 }).eq('id', order!.id);
    const insertLine = await client
      .from('work_order_lines')
      .insert({ work_order_id: order!.id, position: 9, name: 'Directo', price: 1 });

    expect(update.error?.code).toBe('42501');
    expect(insertLine.error?.code).toBe('42501');
  });

  it('nobody deletes an order (CA-24, RN-06)', async () => {
    const { client } = await signedInAs(SEED.admin);
    const { data: order } = await client.from('work_orders').select('id').limit(1).single();

    const { error } = await client.from('work_orders').delete().eq('id', order!.id);

    expect(error?.code).toBe('42501');
  });

  it('an operator cannot correct a closed order (RN-05)', async () => {
    const { client } = await signedInAs(SEED.operator);
    const { data: closed } = await client
      .from('work_orders')
      .select('id')
      .eq('status', 'closed')
      .limit(1)
      .single();

    const { error } = await client.rpc('correct_work_order', {
      p_id: closed!.id,
      p_lines: [],
      p_payments: [],
      p_reason: 'Intento',
    });

    expect(error?.hint).toBe('work_order_admin_only');
  });

  it('a customer reads no order', async () => {
    const { client } = await signedInAs(SEED.customer);

    const orders = await client.from('work_orders').select('id');
    const summaries = await client.from('work_order_summaries').select('id');

    expect(orders.data).toEqual([]);
    expect(summaries.data).toEqual([]);
  });
});
