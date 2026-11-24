import { requireCustomer } from '@web/modules/auth/api/auth.server';
import { getMyData, listMyRequests } from '@web/modules/data-rights/api/data-rights.server';
import MyDataScreen from '@web/modules/data-rights/components/organisms/my-data-screen.component';

/** «Mis datos» (spec 017, HU-01, HU-02): the customer's own data and requests. Staff go home. */
const MyDataPage = async () => {
  await requireCustomer();
  const [data, requests] = await Promise.all([getMyData(), listMyRequests()]);

  return <MyDataScreen data={data} requests={requests} />;
};

export default MyDataPage;
