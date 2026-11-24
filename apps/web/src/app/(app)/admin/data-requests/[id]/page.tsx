import { notFound } from 'next/navigation';

import { z } from 'zod';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getDataRequest, openOrderOf } from '@web/modules/data-rights/api/data-rights.server';
import DataRequestDetail from '@web/modules/data-rights/components/organisms/data-request-detail.component';

type DataRequestPageProps = { params: Promise<{ id: string }> };

/** A data request for the admin to attend (spec 017, HU-03). Admin only (RN-01, CA-15). */
const DataRequestPage = async ({ params }: DataRequestPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const request = await getDataRequest(id);
  if (!request) notFound();
  // CA-13: the open order that stops an erasure, only while it can still be erased.
  const openOrder =
    request.kind === 'erasure' && request.status === 'received'
      ? await openOrderOf(request.customer_id)
      : null;

  return <DataRequestDetail request={request} openOrder={openOrder} />;
};

export default DataRequestPage;
