// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import { execSync } from 'child_process';
import packageJSON from '../../package.json';

export function zipMacOSRelease(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const files = fs
    .readdirSync('release')
    .filter(file => path.extname(file) === '.zip');
  if (!files.length) {
    throw new Error(
      'No zip file found. Maybe the release did not complete properly?'
    );
  }
  if (files.length > 1) {
    throw new Error(
      'More than one zip file found, release directory was not cleared.'
    );
  }
  const zipFile = files[0];
  const zipPath = path.join('release', zipFile);

  console.log('Removing current zip file');
  rimraf.sync(zipPath);

  const appName = `${packageJSON.productName}.app`;
  const appPath = path.join('release', 'mac', appName);

  const tmpPath = path.join('release', 'tmp');
  const appDir = path.dirname(appPath);
  const tmpZip = path.join(appDir, zipFile);
  console.log('Creating temporary zip file at', tmpZip);
  try {
    execSync(`cd ${appDir} && zip -ro ${zipFile} "${appName}"`);
    console.log(
      'Unzipping to remove duplicate electron references from',
      tmpZip
    );
    execSync(`unzip ${tmpZip} -d ${tmpPath}`);
  } catch (err) {
    console.log('stdout:', String(err.stdout));
    console.log('stderr:', String(err.stderr));
    throw err;
  }
  console.log('Removing temporary zip file');
  rimraf.sync(tmpZip);

  const electronFrameworkPath = path.join(
    tmpPath,
    appName,
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
    'Versions'
  );
  console.log('Removing duplicate electron framework', electronFrameworkPath);
  rimraf.sync(electronFrameworkPath);

  try {
    console.log('Creating final zip');
    execSync(`cd ${tmpPath} && zip -ro ${zipFile} "${appName}"`);
  } catch (err) {
    console.log('stdout:', String(err.stdout));
    console.log('stderr:', String(err.stderr));
    throw err;
  }
  console.log('Moving into the final destination', zipPath);
  fs.renameSync(path.join(tmpPath, zipFile), zipPath);
  rimraf.sync(tmpPath);

  console.log('zip-macos-release is done');
}
