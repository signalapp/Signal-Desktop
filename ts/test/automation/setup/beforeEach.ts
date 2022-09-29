import { _electron, Page } from '@playwright/test';
import { readdirSync, rmdirSync } from 'fs-extra';
import { dirname, join } from 'path';
import { MULTI_PREFIX, NODE_ENV, openElectronAppOnly } from './open';
// tslint:disable: no-console

const getDirectoriesOfSessionDataPath = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      return dirent.name;
    })
    .filter(n => n.includes(`${NODE_ENV}-${MULTI_PREFIX}`));

let alreadyCleaned = false;
let alreadyCleanedWaiting = false;

const cleanUpOtherTest = async () => {
  if (alreadyCleaned || alreadyCleanedWaiting) {
    return;
  }
  alreadyCleaned = true;

  const electronApp = await openElectronAppOnly('start');

  const appPath = await electronApp.evaluate(async ({ app }) => {
    return app.getPath('userData');
  });
  const window = await electronApp.firstWindow();
  await window.close();
  if (alreadyCleaned && alreadyCleanedWaiting) {
    return;
  }
  alreadyCleanedWaiting = true;

  if (!appPath.length) {
    throw new Error('appDataPath unset');
  }

  const parentFolderOfAllDataPath = dirname(appPath);

  if (!parentFolderOfAllDataPath || parentFolderOfAllDataPath.length < 20) {
    throw new Error('parentFolderOfAllDataPath not found or invalid');
  }
  console.info('cleaning other tests leftovers...', parentFolderOfAllDataPath);

  const allAppDataPath = getDirectoriesOfSessionDataPath(parentFolderOfAllDataPath);
  console.info('allAppDataPath', allAppDataPath);

  allAppDataPath.map(folder => {
    if (!appPath) {
      throw new Error('parentFolderOfAllDataPath unset');
    }
    const pathToRemove = join(parentFolderOfAllDataPath, folder);
    rmdirSync(pathToRemove, { recursive: true });
  });
  console.info('...done');
};

export const beforeAllClean = cleanUpOtherTest;

export const forceCloseAllWindows = async (windows: Array<Page>) => {
  return Promise.all(windows.map(w => w.close()));
};
