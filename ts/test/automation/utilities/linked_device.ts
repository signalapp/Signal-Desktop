import { _electron } from 'playwright-core';
import { logIn } from '../setup/log_in';
import { openApp } from '../setup/open';

export async function linkedDevice(recoveryPhrase: string) {
  const [windowB] = await openApp(1);

  await logIn(windowB, recoveryPhrase);

  return [windowB];
}
