import { getActiveCustomer } from '@web/modules/auth/api/auth.server';
import { getMyData } from '@web/modules/data-rights/api/data-rights.server';
import { dataFileResponse } from '@web/modules/data-rights/utils/data-file.utils';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

/**
 * «Descargar mis datos» (spec 017, CA-02): everything the business keeps of the signed-in customer,
 * as a file named by the day. Only an enabled customer gets it, and only theirs (CA-03).
 */
export const GET = async () => {
  if (!(await getActiveCustomer())) return new Response(null, { status: 403 });
  return dataFileResponse(await getMyData(), `mis-datos-${todayIn(new Date())}.json`);
};
