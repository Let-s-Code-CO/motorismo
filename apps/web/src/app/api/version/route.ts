import { env } from '@web/modules/core/config/env.config';

/** Always answered by the running deployment, never from a cache. */
export const dynamic = 'force-dynamic';

/**
 * The version of the deployment that is live now (spec 006). An open app compares it with the
 * version it was built with to offer «Actualizar» (HU-04, CA-15); while offline, any answer means
 * the network is back (HU-02, CA-08). No session needed: the proxy leaves this path out.
 */
export const GET = () =>
  Response.json(
    { version: env.NEXT_PUBLIC_APP_VERSION },
    { headers: { 'cache-control': 'no-store' } }
  );
