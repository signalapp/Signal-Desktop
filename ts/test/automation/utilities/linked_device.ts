import { logIn } from '../setup/log_in';
import { openApp } from '../setup/open';

export async function linkedDevice(recoveryPhrase: string) {
  const [windowB] = await openApp(1); // not using sessionTest here as we need to close and reopen one of the window

  await logIn(windowB, recoveryPhrase);

  return [windowB];
}
