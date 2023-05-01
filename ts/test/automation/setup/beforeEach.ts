import { Page } from '@playwright/test';
import { readdirSync, rmdirSync } from 'fs-extra';
import { join } from 'path';
import { isMacOS } from '../../../OS';
import { MULTI_PREFIX, NODE_ENV } from './open';
// tslint:disable: no-console

const getDirectoriesOfSessionDataPath = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      return dirent.name;
    })
    .filter(n => n.includes(`${NODE_ENV}-${MULTI_PREFIX}`));

const alreadyCleaned = false;
let alreadyCleanedWaiting = false;

function cleanUpOtherTest() {
  if (alreadyCleaned || alreadyCleanedWaiting) {
    return;
  }

  alreadyCleanedWaiting = true;

  const parentFolderOfAllDataPath = isMacOS() ? '~/Library/Application Support/' : null;
  if (!parentFolderOfAllDataPath) {
    throw new Error('Only macOS is currrently supported ');
  }

  if (!parentFolderOfAllDataPath || parentFolderOfAllDataPath.length < 20) {
    throw new Error('parentFolderOfAllDataPath not found or invalid');
  }
  console.info('cleaning other tests leftovers...', parentFolderOfAllDataPath);

  const allAppDataPath = getDirectoriesOfSessionDataPath(parentFolderOfAllDataPath);
  console.info('allAppDataPath', allAppDataPath);

  allAppDataPath.map(folder => {
    const pathToRemove = join(parentFolderOfAllDataPath, folder);
    rmdirSync(pathToRemove, { recursive: true });
  });
  console.info('...done');
}

export const beforeAllClean = cleanUpOtherTest;

export const forceCloseAllWindows = async (windows: Array<Page>) => {
  return Promise.all(windows.map(w => w.close()));
};
