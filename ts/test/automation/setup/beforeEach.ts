import { _electron, Page } from '@playwright/test';
import { readdirSync, rmdirSync } from 'fs-extra';
import { dirname, join } from 'path';
import { MULTI_PREFIX, NODE_ENV, openElectronAppOnly } from './open';

const getDirectoriesOfSessionDataPath = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(n => n.startsWith(`Session-${NODE_ENV}-${MULTI_PREFIX}`));

export const cleanUpOtherTest = async () => {
  const electronApp = await openElectronAppOnly('start');
  const appPath = await electronApp.evaluate(async ({ app }) => {
    return app.getPath('userData');
  });
  const window = await electronApp.firstWindow();
  await window.close();
  if (!appPath.length) {
    throw new Error('appDataPath unset');
  }
  const parentFolderOfAllDataPath = dirname(appPath);

  if (!parentFolderOfAllDataPath || parentFolderOfAllDataPath.length < 20) {
    throw new Error('parentFolderOfAllDataPath not found or invalid');
  }

  const allAppDataPath = getDirectoriesOfSessionDataPath(parentFolderOfAllDataPath);
  allAppDataPath.map(folder => {
    if (!appPath) {
      throw new Error('parentFolderOfAllDataPath unset');
    }
    const pathToRemove = join(parentFolderOfAllDataPath, folder);
    rmdirSync(pathToRemove, { recursive: true });
  });
};

export const forceCloseAllWindows = async (windows: Array<Page>) => {
  return Promise.all(windows.map(w => w.close()));
};
