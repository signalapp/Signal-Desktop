import { _electron } from '@playwright/test';
import { join } from 'path';
import { getAppRootPath } from '../../../node/getRootPath';

export const NODE_ENV = 'production';
export const MULTI_PREFIX = 'test-integration-testnet-';
const multisAvailable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// tslint:disable: no-console

export async function openApp(windowsToCreate: number) {
  if (windowsToCreate >= multisAvailable.length) {
    throw new Error(`Do you really need ${multisAvailable.length} windows?!`);
  }
  // if windowToCreate = 3, this array will be ABC. If windowToCreate = 5, this array will be ABCDE
  const multisToUse = multisAvailable.slice(0, windowsToCreate);
  return Promise.all(
    [...multisToUse].map(async m => {
      return openAppAndWait(`${m}`);
    })
  );
}

export const openElectronAppOnly = async (multi: string) => {
  process.env.NODE_APP_INSTANCE = `${MULTI_PREFIX}-${Date.now()}-${multi}`;
  process.env.NODE_ENV = NODE_ENV;

  console.info(' NODE_ENV', process.env.NODE_ENV);
  console.info(' NODE_APP_INSTANCE', process.env.NODE_APP_INSTANCE);
  const electronApp = await _electron.launch({
    args: [join(getAppRootPath(), 'ts', 'mains', 'main_node.js')],
  });
  return electronApp;
};

export const openAppAndWait = async (multi: string) => {
  const electronApp = await openElectronAppOnly(multi);
  // Get the first window that the app opens, wait if necessary.
  const window = await electronApp.firstWindow();

  // await window.reload();
  return window;
};
