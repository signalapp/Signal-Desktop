import { _electron } from 'playwright-core';
import { openAppsAndNewUsers, openAppsNoNewUsers } from '../setup/new_user';
import { logIn } from '../setup/log_in';

export async function linkedDevice() {
  const windowLoggedIn = await openAppsAndNewUsers(1);
  const [windowA1] = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [userA] = users;
  const [windowA2] = await openAppsNoNewUsers(1);

  await logIn(windowA2, userA.recoveryPhrase);

  return { windowA1, windowA2, userA };
}
