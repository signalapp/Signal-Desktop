// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import { execSync } from 'child_process';
import packageJSON from '../../package.json';

function zipMacOSRelease(): void {
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
  if (files.length !== 2) {
    throw new Error(
      'Multiple versions of zip files found, release directory was not cleared.'
    );
  }

  for (const zipFile of files) {
    const zipPath = path.join('release', zipFile);

    console.log('Removing current zip file', zipFile);
    rimraf.sync(zipPath);

    const postfix = zipFile.includes('arm64') ? '-arm64' : '';

    const appName = `${packageJSON.productName}.app`;
    const appPath = path.join('release', `mac${postfix}`, appName);

    const tmpPath = path.join('release', `tmp${postfix}`);
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
  }

  console.log('zip-macos-release is done');
}

zipMacOSRelease();
