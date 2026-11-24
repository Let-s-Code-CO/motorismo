import { z } from 'zod';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { getCustomerData } from '@web/modules/data-rights/api/data-rights.server';
import { dataFileResponse } from '@web/modules/data-rights/utils/data-file.utils';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type Context = { params: Promise<{ id: string }> };

/**
 * A customer's data for the admin, to answer an inquiry (spec 017, CA-17). Anyone else gets 403
 * (CA-15); the database function checks again.
 */
export const GET = async (_request: Request, { params }: Context) => {
  if (!(await getActiveAdmin())) return new Response(null, { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  return dataFileResponse(await getCustomerData(id), `datos-cliente-${todayIn(new Date())}.json`);
};
