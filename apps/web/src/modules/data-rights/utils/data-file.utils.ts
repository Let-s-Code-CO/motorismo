import type { CustomerData } from '@web/modules/data-rights/types/data-rights.types';

/**
 * A customer's data as a file (spec 017, CA-02, CA-17): JSON, indented, so a person can read it
 * and a program can process it. Never kept in a shared cache.
 */
export const dataFileResponse = (data: CustomerData, fileName: string) =>
  new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
