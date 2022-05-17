import { _electron } from 'playwright-core';
import { openAppsAndNewUsers, openAppsNoNewUsers } from './new_user';

export async function linkedDevice() {
  const windowLoggedIn = await openAppsAndNewUsers(1);
  const [windowA1] = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [userA] = users;
  const [windowA2] = await openAppsNoNewUsers(1);

  return { windowA1, windowA2, userA };
}
