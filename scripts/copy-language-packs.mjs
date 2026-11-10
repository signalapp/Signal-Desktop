// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fse from 'fs-extra';
import pMap from 'p-map';
import { buildBinary as buildBPlist } from 'plist';

/** @import { AfterPackContext } from 'electron-builder' */

/**
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export async function afterPack({ appOutDir, packager, electronPlatformName }) {
  /** @type {string} */
  let defaultLocale;
  const ourLocalesPath = path.join(import.meta.dirname, '..', '_locales');
  const ourLocales = await fse.readdir(ourLocalesPath);

  /** @type {Map<string, string>} */
  let localeMap;

  /** @type {string} */
  let localesPath;
  if (electronPlatformName === 'darwin' || electronPlatformName === 'mas') {
    const { productFilename } = packager.appInfo;

    // en.lproj/*
    // zh_CN.lproj/*
    defaultLocale = 'en.lproj';
    localeMap = new Map(
      ourLocales.map(locale => [locale, `${locale.replace(/-/g, '_')}.lproj`])
    );

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
    localeMap = new Map(
      ourLocales.map(locale => {
        if (locale === 'en') {
          return [locale, defaultLocale];
        }

        return [locale, `${locale.replace(/_/g, '-')}.pak`];
      })
    );

    localesPath = path.join(appOutDir, 'locales');
  } else {
    console.error(
      `Unsupported platform: ${electronPlatformName}, not copying pak files`
    );
    return;
  }

  const electronLocales = new Set(await fse.readdir(localesPath));

  await pMap(
    Array.from(localeMap.entries()),
    async ([srcLocale, dstLocale]) => {
      if (!electronLocales.has(dstLocale)) {
        console.log(`Copying ${defaultLocale} to ${dstLocale}`);
        await fse.copy(
          path.join(localesPath, defaultLocale),
          path.join(localesPath, dstLocale)
        );
      }

      // Copy MAS strings into each .lproj folder
      // See https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/AboutInformationPropertyListFiles.html#//apple_ref/doc/uid/TP40009254-102276
      if (electronPlatformName === 'mas') {
        const jsonFile = path.join(
          ourLocalesPath,
          srcLocale,
          'mas-info-plist.json'
        );

        /** @type {Record<string, { messageformat: string }>} */
        const json = JSON.parse(await readFile(jsonFile, 'utf8'));

        /** @type {Record<string, string>} */
        const plist = Object.create(null);
        for (const [key, value] of Object.entries(json)) {
          if (key === 'smartling') {
            continue;
          }
          const { messageformat } = value;
          plist[key] = messageformat;
        }

        await writeFile(
          path.join(localesPath, dstLocale, 'InfoPlist.strings'),
          buildBPlist(plist)
        );
      }
    },
    { concurrency: 16 }
  );
}
