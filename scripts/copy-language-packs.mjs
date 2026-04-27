// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fse from 'fs-extra';
import path from 'node:path';

/** @import { AfterPackContext } from 'electron-builder' */

/**
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export async function afterPack({ appOutDir, packager, electronPlatformName }) {
  /** @type {string} */
  let defaultLocale;
  let ourLocales = await fse.readdir(
    path.join(import.meta.dirname, '..', '_locales')
  );

  /** @type {string} */
  let localesPath;
  if (electronPlatformName === 'darwin' || electronPlatformName === 'mas') {
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

  /** @type {Promise<void>[]} */
  const promises = [];
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
