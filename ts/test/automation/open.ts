import test, { _electron } from '@playwright/test';
import { readdirSync, rmdirSync } from 'fs';

import * as path from 'path';

const NODE_ENV = 'test-integration';

let appDataPath: undefined | string;

test.beforeAll(async () => {
  appDataPath = await getAppDataPath();
});

const getDirectoriesOfSessionDataPath = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(n => n.startsWith(`Session-${NODE_ENV}`));

test.beforeEach(() => {
  if (!appDataPath || !appDataPath.length) {
    throw new Error('appDataPath unset');
  }
  const parentFolderOfAllDataPath = path.dirname(appDataPath);

  if (!parentFolderOfAllDataPath || parentFolderOfAllDataPath.length < 20) {
    throw new Error('parentFolderOfAllDataPath not found or invalid');
  }

  const allAppDataPath = getDirectoriesOfSessionDataPath(parentFolderOfAllDataPath);

  allAppDataPath.map(folder => {
    if (!appDataPath) {
      throw new Error('parentFolderOfAllDataPath unset');
    }
    const pathToRemove = path.join(parentFolderOfAllDataPath, folder);
    console.warn('Removing old test data left at: ', pathToRemove);
    rmdirSync(pathToRemove, { recursive: true });
  });
});

export const getAppDataPath = async () => {
  process.env.NODE_ENV = NODE_ENV;
  const electronApp = await _electron.launch({ args: ['main.js'] });
  const appPath = await electronApp.evaluate(async ({ app }) => {
    return app.getPath('userData');
  });
  const window = await electronApp.firstWindow();
  await window.close();

  return appPath;
};

export const openApp = async (multi: string) => {
  process.env.NODE_APP_INSTANCE = multi;
  process.env.NODE_ENV = NODE_ENV;
  const electronApp = await _electron.launch({ args: ['main.js'] });
  // Get the first window that the app opens, wait if necessary.
  const window = await electronApp.firstWindow();

  await window.reload();
  return window;
};
