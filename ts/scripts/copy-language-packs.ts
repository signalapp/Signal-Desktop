// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fse from 'fs-extra';
import path from 'node:path';
import type { AfterPackContext } from 'electron-builder';

export async function afterPack({
  appOutDir,
  packager,
  electronPlatformName,
}: AfterPackContext): Promise<void> {
  let defaultLocale: string;
  let ourLocales = await fse.readdir(
    path.join(__dirname, '..', '..', '_locales')
  );

  let localesPath: string;
  if (electronPlatformName === 'darwin') {
    const { productFilename } = packager.appInfo;

    // en.lproj/*
    // zh_CN.lproj/*
    defaultLocale = 'en.lproj';
    ourLocales = ourLocales.map(locale => `${locale.replace(/-/g, '_')}.lproj`);

    localesPath = path.join(
      appOutDir,
      `${productFilename}.app`,
      'Contents',
      'Resources'
    );
  } else if (
    electronPlatformName === 'linux' ||
    electronPlatformName === 'win32'
  ) {
    // Shared between windows and linux
    // en-US.pak
    // zh-CN.pak
    defaultLocale = 'en-US.pak';
    ourLocales = ourLocales.map(locale => {
      if (locale === 'en') {
        return defaultLocale;
      }

      return `${locale.replace(/_/g, '-')}.pak`;
    });

    localesPath = path.join(appOutDir, 'locales');
  } else {
    console.error(
      `Unsupported platform: ${electronPlatformName}, not copying pak files`
    );
    return;
  }

  const electronLocales = new Set(await fse.readdir(localesPath));
  const promises = new Array<Promise<void>>();
  for (const locale of ourLocales) {
    if (electronLocales.has(locale)) {
      continue;
    }

    console.log(`Copying ${defaultLocale} to ${locale}`);
    promises.push(
      fse.copy(
        path.join(localesPath, defaultLocale),
        path.join(localesPath, locale)
      )
    );
  }

  await Promise.all(promises);
}
