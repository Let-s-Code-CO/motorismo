import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { listUsers } from '@web/modules/users/api/users.server';
import UsersScreen from '@web/modules/users/components/organisms/users-screen.component';

/** Admin-only (CA-08; spec 004, CA-09 for customers). The data is also protected by RLS (CA-09). */
const UsersPage = async () => {
  const user = await getStaffForPage();
  if (!user) return <NoPermission audience="customer" />;
  if (user.role !== 'admin') return <NoPermission audience="operator" />;

  const users = await listUsers();
  return <UsersScreen users={users} currentUserId={user.id} />;
};

export default UsersPage;
